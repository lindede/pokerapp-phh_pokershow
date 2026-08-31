/** 「我」页列表：两组白卡片，组间留空，无分组标题 */
export type ProfileMenuAction =
  | "categories_all"
  | "favorites"
  | "review"
  | "categories_mine";

export type ProfileMenuIconType =
  | "categories"
  | "favorites"
  | "review"
  | "folders";

export interface ProfileMenuItem {
  key: ProfileMenuAction;
  label: string;
  icon: ProfileMenuIconType;
}

export interface ProfileMenuGroup {
  id: string;
  items: ProfileMenuItem[];
}

export const PROFILE_MENU_GROUPS: ReadonlyArray<ProfileMenuGroup> = [
  {
    id: "categories_all",
    items: [
      {
        key: "categories_all",
        label: "所有牌局分类",
        icon: "categories",
      },
    ],
  },
  {
    id: "more",
    items: [
      { key: "favorites", label: "收藏", icon: "favorites" },
      { key: "review", label: "复盘", icon: "review" },
      { key: "categories_mine", label: "我的牌局分类", icon: "folders" },
    ],
  },
];
