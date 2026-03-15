export type WordAudioSSEEventType =
  | 'word_audio:start'
  | 'word_audio:tts'
  | 'word_audio:upload'
  | 'word_audio:persist'
  | 'word_audio:part_complete'
  | 'word_audio:complete'
  | 'word_audio:error';

export interface WordAudioStartData {
  word_entry_id: string;
  part_count: number;
}

export interface WordAudioPartData {
  part: 'lemma' | 'example';
  example_id: string | null;
}

export interface WordAudioTtsData extends WordAudioPartData {
  part_index: number;
  total_parts: number;
}

export interface WordAudioUploadData extends WordAudioPartData {
  s3_key: string;
}

export interface WordAudioPartCompleteData extends WordAudioPartData {
  part_index: number;
  total_parts: number;
}

export interface WordAudioCompleteData {
  word_entry_id: string;
  parts_completed: number;
}

export interface WordAudioErrorData {
  part: 'lemma' | 'example' | null;
  example_id: string | null;
  stage: string;
  error: string;
  word_entry_id: string;
}

/** Progress state for a single part */
export type WordAudioPartStage = 'tts' | 'upload' | 'persist' | 'complete' | 'error';

/** Key for identifying a part: "lemma" or "example:{example_id}" */
export type WordAudioPartKey = string;

export interface WordAudioProgress {
  /** Map from part key to current stage */
  parts: Map<WordAudioPartKey, WordAudioPartStage>;
  totalParts: number;
  partsCompleted: number;
  status: 'idle' | 'generating' | 'complete' | 'error';
  errorMessage: string | null;
}
