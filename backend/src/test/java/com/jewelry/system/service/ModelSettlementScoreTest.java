package com.jewelry.system.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ModelSettlementScoreTest {

    @Test
    void blankReviewIsBaseScoreOnly() {
        assertEquals(10, ModelSettlementScore.coefficient(null, null, 0, 0, 0, 0, 0, 0, 0, 0));
    }

    @Test
    void matchesFeishuFormula() {
        int score = ModelSettlementScore.coefficient(
                "异形（戒圈完全重构）",
                "多种纹理",
                1,
                0,
                2,
                9,
                1,
                1,
                1,
                8
        );
        // 10 + 45 + 20 + 3 + 60 + 5 + 10 + 15；高度复杂 9 件和曲面排石 8 件不计
        assertEquals(168, score);
    }
}
