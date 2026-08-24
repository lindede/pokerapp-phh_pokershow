/** 底部主导航 Tab 高度（rpx），用于 scroll / dock 留白计算 */
export const APP_TAB_BAR_HEIGHT_RPX = 88;

export type AppTabKey = "commentary" | "review" | "profile";

export const APP_TAB_ITEMS: ReadonlyArray<{
  key: AppTabKey;
  label: string;
  url: string;
}> = [
  { key: "commentary", label: "讲解", url: "/pages/index/index" },
  { key: "review", label: "复盘", url: "/pages/review/index" },
  { key: "profile", label: "我", url: "/pages/profile/index" },
];
