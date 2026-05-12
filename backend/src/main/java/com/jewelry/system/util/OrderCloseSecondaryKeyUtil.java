package com.jewelry.system.util;

import java.time.LocalDate;

/**
 * 订单「二级密钥」：按业务约定由日期派生，用于超出每日关闭次数后的人工授权校验。
 * <p>
 * 规则（与业务说明一致）：设当日 MMDD 为四位字符串（如 5 月 12 日为 0512），年份为 YYYY；
 * 将 MMDD 字符串反转得到四位数字（0512 → 2150）；计算 {@code MMDD * YYYY + 反转值} 得到整数，
 * 再将其十进制字符串从 0 起编号各位；若 MMDD 最后一位为双数则取所有「偶数位」上的字符组成密钥，
 * 若为奇数则取所有「奇数位」上的字符组成密钥。
 * </p>
 * 例：2026-05-12 → 512*2026+2150=1039462，0512 末位为双数 → 取下标 0,2,4,6 → <b>1342</b>。
 */
public final class OrderCloseSecondaryKeyUtil {

    private OrderCloseSecondaryKeyUtil() {
    }

    public static String expectedKey(LocalDate date) {
        String mmdd = String.format("%02d%02d", date.getMonthValue(), date.getDayOfMonth());
        int year = date.getYear();
        int mmddNum = Integer.parseInt(mmdd, 10);
        String reversed = new StringBuilder(mmdd).reverse().toString();
        int revNum = Integer.parseInt(reversed, 10);
        long product = (long) mmddNum * year + revNum;
        String digits = Long.toString(product);
        char last = mmdd.charAt(mmdd.length() - 1);
        boolean dayEven = ((last - '0') % 2) == 0;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < digits.length(); i++) {
            boolean posEven = (i % 2) == 0;
            if (dayEven && posEven) {
                sb.append(digits.charAt(i));
            } else if (!dayEven && !posEven) {
                sb.append(digits.charAt(i));
            }
        }
        return sb.toString();
    }

    public static boolean matches(String userInput, LocalDate date) {
        if (userInput == null) {
            return false;
        }
        String norm = userInput.trim().replaceAll("\\s+", "");
        if (norm.isEmpty()) {
            return false;
        }
        return norm.equals(expectedKey(date));
    }
}
