package com.moje.jewelry3d.inlay.service;

import com.moje.jewelry3d.config.InlayV2Config;
import com.moje.jewelry3d.inlay.entity.InlayPreviewJobEntity;
import com.moje.jewelry3d.inlay.repository.InlayPreviewJobRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * 预览/mesh 任务队列：Redis 或内存降级
 */
@Slf4j
@Service
public class InlayPreviewJobService {

    private static final String REDIS_QUEUE_KEY = "inlay:preview:jobs";

    private final InlayV2Config config;
    private final InlayPreviewJobRepository jobRepository;
    private final StringRedisTemplate redisTemplate;
    private final ConcurrentLinkedQueue<String> memoryQueue = new ConcurrentLinkedQueue<>();

    @Autowired
    public InlayPreviewJobService(
            InlayV2Config config,
            InlayPreviewJobRepository jobRepository,
            @Autowired(required = false) StringRedisTemplate redisTemplate
    ) {
        this.config = config;
        this.jobRepository = jobRepository;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    public InlayPreviewJobEntity enqueue(String inlayId, String jobType, int priority) {
        InlayPreviewJobEntity job = new InlayPreviewJobEntity();
        job.setId(UUID.randomUUID().toString());
        job.setInlayId(inlayId);
        job.setJobType(jobType);
        job.setPriority(priority);
        job.setStatus("pending");
        job.setAttempts(0);
        jobRepository.save(job);

        if (useRedis()) {
            if (redisTemplate != null) {
                redisTemplate.opsForList().leftPush(REDIS_QUEUE_KEY, job.getId());
            }
        } else {
            memoryQueue.offer(job.getId());
        }
        log.debug("Enqueued {} job {} for inlay {}", jobType, job.getId(), inlayId);
        return job;
    }

    public List<InlayPreviewJobEntity> listJobs(String status, int limit) {
        if (status != null && !status.isBlank()) {
            return jobRepository.findAll(PageRequest.of(0, limit)).getContent().stream()
                    .filter(j -> status.equals(j.getStatus()))
                    .toList();
        }
        return jobRepository.findAll(PageRequest.of(0, limit)).getContent();
    }

    public long countPending() {
        return jobRepository.countByStatus("pending");
    }

    /** 供 Python worker 轮询领取任务 */
    @Transactional
    public Optional<InlayPreviewJobEntity> claimNextJob() {
        String jobId = null;
        if (useRedis()) {
            if (redisTemplate != null) {
                jobId = redisTemplate.opsForList().rightPop(REDIS_QUEUE_KEY);
            }
        }
        if (jobId == null) {
            jobId = memoryQueue.poll();
        }
        if (jobId == null) {
            List<InlayPreviewJobEntity> pending = jobRepository.findPendingJobs(PageRequest.of(0, 1));
            if (pending.isEmpty()) return Optional.empty();
            jobId = pending.get(0).getId();
        }

        InlayPreviewJobEntity job = jobRepository.findById(jobId).orElse(null);
        if (job == null || !"pending".equals(job.getStatus())) return Optional.empty();

        job.setStatus("running");
        job.setAttempts(job.getAttempts() + 1);
        job.setUpdatedAt(LocalDateTime.now());
        jobRepository.save(job);
        return Optional.of(job);
    }

    @Transactional
    public void completeJob(String jobId, boolean success, String errorMsg) {
        jobRepository.findById(jobId).ifPresent(job -> {
            job.setStatus(success ? "completed" : "failed");
            job.setErrorMsg(errorMsg);
            job.setUpdatedAt(LocalDateTime.now());
            jobRepository.save(job);
        });
    }

    @Scheduled(fixedDelayString = "${inlay-v2.queue.poll-interval-ms:30000}")
    public void processPendingJobs() {
        if (jobRepository.countByStatus("pending") == 0) return;
        log.debug("Inlay preview queue: {} pending jobs", jobRepository.countByStatus("pending"));
    }

    private boolean useRedis() {
        return "redis".equalsIgnoreCase(config.getQueue().getType()) && redisTemplate != null;
    }
}
