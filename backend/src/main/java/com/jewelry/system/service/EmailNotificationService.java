package com.jewelry.system.service;

import com.jewelry.system.entity.SysConfig;
import com.jewelry.system.repository.SysConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.mail.*;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.util.Properties;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailNotificationService {

    private final SysConfigRepository configRepository;

    public void sendOrderNotification(String orderNumber, String clientContact, String taskType) {
        try {
            String adminEmail = getAdminEmail();
            if (adminEmail == null || adminEmail.isBlank()) {
                log.warn("未配置管理员邮箱，无法发送通知");
                return;
            }

            String subject = String.format("【珠宝定制系统】新订单通知 - %s", orderNumber);
            String content = String.format(
                "<html><body>" +
                "<h3>新订单创建成功</h3>" +
                "<p>订单编号：%s</p>" +
                "<p>客户联系方式：%s</p>" +
                "<p>任务类型：%s</p>" +
                "<p>请及时跟进处理。</p>" +
                "</body></html>",
                orderNumber, clientContact, taskType
            );

            sendEmail(adminEmail, subject, content);
            log.info("订单通知邮件已发送至管理员邮箱: {}", adminEmail);
        } catch (Exception e) {
            log.error("发送订单通知邮件失败", e);
        }
    }

    public void sendRejectionNotification(String orderNumber, String reason) {
        try {
            String adminEmail = getAdminEmail();
            if (adminEmail == null || adminEmail.isBlank()) {
                log.warn("未配置管理员邮箱，无法发送通知");
                return;
            }

            String subject = String.format("【珠宝定制系统】订单驳回通知 - %s", orderNumber);
            String content = String.format(
                "<html><body>" +
                "<h3>订单已被驳回</h3>" +
                "<p>订单编号：%s</p>" +
                "<p>驳回原因：%s</p>" +
                "<p>请协调处理。</p>" +
                "</body></html>",
                orderNumber, reason
            );

            sendEmail(adminEmail, subject, content);
            log.info("订单驳回通知邮件已发送至管理员邮箱: {}", adminEmail);
        } catch (Exception e) {
            log.error("发送驳回通知邮件失败", e);
        }
    }

    public void sendReminder(String orderNumber, String message) {
        try {
            String adminEmail = getAdminEmail();
            if (adminEmail == null || adminEmail.isBlank()) {
                log.warn("未配置管理员邮箱，无法发送提醒");
                return;
            }

            String subject = String.format("【珠宝定制系统】订单提醒 - %s", orderNumber);
            String content = String.format(
                "<html><body>" +
                "<h3>订单提醒</h3>" +
                "<p>订单编号：%s</p>" +
                "<p>提醒内容：%s</p>" +
                "</body></html>",
                orderNumber, message
            );

            sendEmail(adminEmail, subject, content);
            log.info("订单提醒邮件已发送至管理员邮箱: {}", adminEmail);
        } catch (Exception e) {
            log.error("发送提醒邮件失败", e);
        }
    }

    private String getAdminEmail() {
        return configRepository.findByConfigKey("admin.reminder.email")
                .map(SysConfig::getConfigValue)
                .orElse(null);
    }

    private void sendEmail(String to, String subject, String content) throws MessagingException {
        String host = getConfig("smtp.host", "smtp.qq.com");
        String port = getConfig("smtp.port", "587");
        String username = getConfig("smtp.username", "");
        String password = getConfig("smtp.password", "");
        String from = getConfig("smtp.from", username);

        Properties props = new Properties();
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.host", host);
        props.put("mail.smtp.port", port);

        Session session = Session.getInstance(props, new Authenticator() {
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(username, password);
            }
        });

        Message message = new MimeMessage(session);
        message.setFrom(new InternetAddress(from));
        message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
        message.setSubject(subject);
        message.setContent(content, "text/html;charset=UTF-8");

        Transport.send(message);
    }

    private String getConfig(String key, String defaultValue) {
        return configRepository.findByConfigKey(key)
                .map(SysConfig::getConfigValue)
                .orElse(defaultValue);
    }
}