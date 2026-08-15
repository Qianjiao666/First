export const USER_ROLES = ["USER", "MODERATOR", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];
type PermissionTree = Record<string, Record<string, readonly UserRole[]>>;

export const PERMISSIONS: PermissionTree = {
  forum: {
    createPost: ["USER", "MODERATOR", "ADMIN"],
    createComment: ["USER", "MODERATOR", "ADMIN"],
    vote: ["USER", "MODERATOR", "ADMIN"],
    editOwnPost: ["USER", "MODERATOR", "ADMIN"],
    deleteOwnPost: ["USER", "MODERATOR", "ADMIN"],
    deleteOwnComment: ["USER", "MODERATOR", "ADMIN"],
    deleteAnyPost: ["MODERATOR", "ADMIN"],
    deleteAnyComment: ["MODERATOR", "ADMIN"],
    pinPost: ["MODERATOR", "ADMIN"],
    lockPost: ["MODERATOR", "ADMIN"],
    manageCategories: ["USER", "MODERATOR", "ADMIN"],
    manageTags: ["ADMIN"],
  },
  admin: {
    access: ["MODERATOR", "ADMIN"],
    manageForum: ["MODERATOR", "ADMIN"],
    manageUsers: ["ADMIN"],
    manageRedeemCodes: ["ADMIN"],
    manageSensitiveWords: ["ADMIN"],
    transferAccount: ["ADMIN"],
  },
  tasks: {
    create: ["USER", "MODERATOR", "ADMIN"],
    update: ["USER", "MODERATOR", "ADMIN"],
    publish: ["USER", "MODERATOR", "ADMIN"],
    close: ["ADMIN"],
    archive: ["ADMIN"],
    delete: ["ADMIN"],
    manageCategories: ["ADMIN"],
    manage: ["ADMIN"],
    apply: ["USER", "MODERATOR", "ADMIN"],
    assign: ["ADMIN"],
    submit: ["USER", "MODERATOR", "ADMIN"],
    complete: ["ADMIN"],
  },
};

export type ReputationLevel = {
  title: string;
  minimum: number;
};

export const REPUTATION_LEVELS: readonly ReputationLevel[] = [
  { title: "游客", minimum: 0 },
  { title: "新手上路", minimum: 10 },
  { title: "初级会员", minimum: 100 },
  { title: "中级会员", minimum: 500 },
  { title: "高级会员", minimum: 1500 },
  { title: "金牌会员", minimum: 4000 },
  { title: "论坛元老", minimum: 10000 },
  { title: "至尊元老", minimum: 25000 },
  { title: "声望之神", minimum: 50000 },
];

export type LevelInfo = {
  current: ReputationLevel;
  next: ReputationLevel | null;
  progress: number;
  remaining: number;
};

export function canRole(role: UserRole, resource: string, action: string): boolean {
  return PERMISSIONS[resource]?.[action]?.includes(role) ?? false;
}

export function getLevelInfo(reputation: number): LevelInfo {
  const normalizedReputation = Math.max(0, Math.floor(Number.isFinite(reputation) ? reputation : 0));
  const currentIndex = REPUTATION_LEVELS.reduce(
    (selectedIndex, level, index) => (level.minimum <= normalizedReputation ? index : selectedIndex),
    0,
  );
  const current = REPUTATION_LEVELS[currentIndex];
  const next = REPUTATION_LEVELS[currentIndex + 1] ?? null;

  if (!next) {
    return { current, next: null, progress: 100, remaining: 0 };
  }

  const progress = Math.min(
    100,
    Math.floor(((normalizedReputation - current.minimum) / (next.minimum - current.minimum)) * 100),
  );

  return {
    current,
    next,
    progress,
    remaining: Math.max(0, next.minimum - normalizedReputation),
  };
}

export function getUserTitle(role: UserRole, reputation: number): string {
  if (role === "ADMIN") return "管理员";
  if (role === "MODERATOR") return "版主";
  return getLevelInfo(reputation).current.title;
}
