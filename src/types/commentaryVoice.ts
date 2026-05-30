/** 解说语音播放器与索引类型（H5 录屏模块共用） */

export type VoiceIndexMap = Map<string, string>;

export interface VoiceListResponse {
  list?: [string, string][];
  error?: string | null;
}

export interface CommentaryVoicePlayer {
  play: (
    url: string,
    opts?: {
      onEnded?: () => void;
      onError?: () => void;
      /** 实际开始播放；durationMs 为 0 表示时长未知 */
      onStart?: (durationMs: number) => void;
      /** 播放过程中拿到更准确的时长（用于重设步进定时器） */
      onDurationRevise?: (durationMs: number) => void;
    },
  ) => void;
  stop: () => void;
  destroy: () => void;
}
