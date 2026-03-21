import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { DeckLevel } from '@/services/adminAPI';
import type {
  SituationCreatePayload,
  SituationDetailResponse,
  SituationListItem,
  SituationStatus,
  DialogNested,
  DescriptionNested,
  PictureNested,
} from '@/types/situation';

// --- Mock data (module-level, not exported) ---

const MOCK_SITUATIONS: SituationListItem[] = [
  {
    id: 'a1b2c3d4-0001-0000-0000-000000000001',
    scenario_el: 'Παραγγελία καφέ σε καφενείο',
    scenario_en: 'Ordering coffee at a kafeneio',
    scenario_ru: 'Заказ кофе в кафенейо',
    cefr_level: 'A1',
    status: 'draft',
    created_at: '2026-01-10T10:00:00Z',
    has_dialog: false,
    has_description: false,
    has_picture: false,
    has_dialog_audio: false,
    has_description_audio: false,
  },
  {
    id: 'a1b2c3d4-0002-0000-0000-000000000002',
    scenario_el: 'Χαιρετισμός γείτονα',
    scenario_en: 'Greeting your neighbor',
    scenario_ru: 'Приветствие соседа',
    cefr_level: 'A1',
    status: 'draft',
    created_at: '2026-01-11T10:00:00Z',
    has_dialog: false,
    has_description: false,
    has_picture: false,
    has_dialog_audio: false,
    has_description_audio: false,
  },
  {
    id: 'a1b2c3d4-0003-0000-0000-000000000003',
    scenario_el: 'Αγορά φρούτων στη λαϊκή',
    scenario_en: 'Buying fruits at the laiki',
    scenario_ru: 'Покупка фруктов на рынке',
    cefr_level: 'A2',
    status: 'partial_ready',
    created_at: '2026-01-12T10:00:00Z',
    has_dialog: true,
    has_description: false,
    has_picture: false,
    has_dialog_audio: false,
    has_description_audio: false,
  },
  {
    id: 'a1b2c3d4-0004-0000-0000-000000000004',
    scenario_el: 'Ερώτηση για οδηγίες προς το μουσείο',
    scenario_en: 'Asking for directions to the museum',
    scenario_ru: 'Просьба указать дорогу к музею',
    cefr_level: 'B1',
    status: 'partial_ready',
    created_at: '2026-01-13T10:00:00Z',
    has_dialog: true,
    has_description: false,
    has_picture: false,
    has_dialog_audio: false,
    has_description_audio: false,
  },
  {
    id: 'a1b2c3d4-0005-0000-0000-000000000005',
    scenario_el: 'Συζήτηση για σχέδια του Σαββατοκύριακου με φίλο',
    scenario_en: 'Discussing weekend plans with a friend',
    scenario_ru: 'Обсуждение планов на выходные с другом',
    cefr_level: 'B2',
    status: 'ready',
    created_at: '2026-01-14T10:00:00Z',
    has_dialog: true,
    has_description: true,
    has_picture: true,
    has_dialog_audio: false,
    has_description_audio: false,
  },
  {
    id: 'a1b2c3d4-0006-0000-0000-000000000006',
    scenario_el: 'Κλείσιμο ραντεβού με γιατρό',
    scenario_en: "Making a doctor's appointment",
    scenario_ru: 'Запись на приём к врачу',
    cefr_level: 'B2',
    status: 'ready',
    created_at: '2026-01-15T10:00:00Z',
    has_dialog: true,
    has_description: true,
    has_picture: true,
    has_dialog_audio: false,
    has_description_audio: false,
  },
];

const MOCK_DIALOG_partial: DialogNested = {
  id: 'dialog-mock-0001',
  status: 'draft',
  num_speakers: 2,
  audio_duration_seconds: null,
  created_at: '2026-01-12T10:05:00Z',
  speakers: [
    { id: 'spk-001', speaker_index: 0, character_name: 'Πωλητής', voice_id: 'voice-a' },
    { id: 'spk-002', speaker_index: 1, character_name: 'Πελάτης', voice_id: 'voice-b' },
  ],
  lines: [
    {
      id: 'line-001',
      line_index: 0,
      speaker_id: 'spk-001',
      text: 'Καλημέρα! Τι θέλετε;',
      start_time_ms: null,
      end_time_ms: null,
      word_timestamps: null,
    },
    {
      id: 'line-002',
      line_index: 1,
      speaker_id: 'spk-002',
      text: 'Καλημέρα! Θέλω μισό κιλό μήλα, παρακαλώ.',
      start_time_ms: null,
      end_time_ms: null,
      word_timestamps: null,
    },
  ],
};

const MOCK_DIALOG_ready: DialogNested = {
  id: 'dialog-mock-0002',
  status: 'exercises_ready',
  num_speakers: 2,
  audio_duration_seconds: 45.5,
  created_at: '2026-01-14T10:05:00Z',
  speakers: [
    { id: 'spk-003', speaker_index: 0, character_name: 'Μαρία', voice_id: 'voice-a' },
    { id: 'spk-004', speaker_index: 1, character_name: 'Νίκος', voice_id: 'voice-b' },
  ],
  lines: [
    {
      id: 'line-003',
      line_index: 0,
      speaker_id: 'spk-003',
      text: 'Τι κάνεις αυτό το Σαββατοκύριακο;',
      start_time_ms: 0,
      end_time_ms: 2500,
      word_timestamps: null,
    },
    {
      id: 'line-004',
      line_index: 1,
      speaker_id: 'spk-004',
      text: 'Σκέφτομαι να πάω στη θάλασσα. Εσύ;',
      start_time_ms: 3000,
      end_time_ms: 6000,
      word_timestamps: null,
    },
  ],
};

const MOCK_DESCRIPTION_ready: DescriptionNested = {
  id: 'desc-mock-0001',
  text_el:
    'Δύο φίλοι συζητούν για τα σχέδιά τους για το Σαββατοκύριακο. Ο ένας θέλει να πάει στη θάλασσα, ενώ ο άλλος προτιμά να μείνει στο σπίτι.',
  source_type: 'original',
  status: 'draft',
  audio_duration_seconds: null,
  audio_a2_duration_seconds: null,
  created_at: '2026-01-14T10:10:00Z',
};

const MOCK_PICTURE_ready: PictureNested = {
  id: 'pic-mock-0001',
  image_prompt: 'Two friends talking outdoors near a Greek beach, casual summer setting',
  status: 'draft',
  created_at: '2026-01-14T10:15:00Z',
};

type MockDetailMap = Record<
  string,
  {
    dialog: DialogNested | null;
    description: DescriptionNested | null;
    picture: PictureNested | null;
  }
>;

const MOCK_DETAIL_MAP: MockDetailMap = {
  'a1b2c3d4-0001-0000-0000-000000000001': { dialog: null, description: null, picture: null },
  'a1b2c3d4-0002-0000-0000-000000000002': { dialog: null, description: null, picture: null },
  'a1b2c3d4-0003-0000-0000-000000000003': {
    dialog: MOCK_DIALOG_partial,
    description: null,
    picture: null,
  },
  'a1b2c3d4-0004-0000-0000-000000000004': {
    dialog: MOCK_DIALOG_partial,
    description: null,
    picture: null,
  },
  'a1b2c3d4-0005-0000-0000-000000000005': {
    dialog: MOCK_DIALOG_ready,
    description: MOCK_DESCRIPTION_ready,
    picture: MOCK_PICTURE_ready,
  },
  'a1b2c3d4-0006-0000-0000-000000000006': {
    dialog: MOCK_DIALOG_ready,
    description: MOCK_DESCRIPTION_ready,
    picture: MOCK_PICTURE_ready,
  },
};

// Mutable working copy (allows create/delete mutations)
let mockSituations = [...MOCK_SITUATIONS];

// --- Store interface ---

interface AdminSituationState {
  // Data
  situations: SituationListItem[];
  selectedSituation: SituationDetailResponse | null;

  // Pagination
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;

  // Loading states
  isLoading: boolean;
  isLoadingDetail: boolean;
  isCreating: boolean;
  isDeleting: boolean;

  // Error
  error: string | null;
  detailError: string | null;

  // Filters
  cefrFilter: DeckLevel | null;
  statusFilter: SituationStatus | null;
  searchQuery: string;

  // Actions
  fetchSituations: () => Promise<void>;
  createSituation: (payload: SituationCreatePayload) => Promise<void>;
  deleteSituation: (id: string) => Promise<void>;
  fetchSituationDetail: (id: string) => Promise<void>;
  setPage: (page: number) => void;
  setCefrFilter: (level: DeckLevel | null) => void;
  setStatusFilter: (status: SituationStatus | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedSituation: (situation: SituationDetailResponse | null) => void;
  clearSelectedSituation: () => void;
  clearError: () => void;
}

// --- Store ---

export const useAdminSituationStore = create<AdminSituationState>()(
  devtools(
    (set, get) => ({
      // Initial state
      situations: [],
      selectedSituation: null,
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
      isLoading: false,
      isLoadingDetail: false,
      isCreating: false,
      isDeleting: false,
      error: null,
      detailError: null,
      cefrFilter: null,
      statusFilter: null,
      searchQuery: '',

      fetchSituations: async () => {
        set({ isLoading: true, error: null });
        await new Promise<void>((resolve) => setTimeout(resolve, 200));
        const { cefrFilter, statusFilter, searchQuery, page, pageSize } = get();

        let filtered = mockSituations;

        if (cefrFilter !== null) {
          filtered = filtered.filter((s) => s.cefr_level === cefrFilter);
        }
        if (statusFilter !== null) {
          filtered = filtered.filter((s) => s.status === statusFilter);
        }
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(
            (s) =>
              s.scenario_en.toLowerCase().includes(query) ||
              s.scenario_ru.toLowerCase().includes(query)
          );
        }

        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const start = (page - 1) * pageSize;
        const situations = filtered.slice(start, start + pageSize);

        set({ situations, total, totalPages, isLoading: false });
      },

      createSituation: async (payload: SituationCreatePayload) => {
        set({ isCreating: true, error: null });
        await new Promise<void>((resolve) => setTimeout(resolve, 200));

        const newItem: SituationListItem = {
          id: crypto.randomUUID(),
          scenario_el: payload.scenario_el,
          scenario_en: payload.scenario_en,
          scenario_ru: payload.scenario_ru,
          cefr_level: payload.cefr_level,
          status: 'draft',
          created_at: new Date().toISOString(),
          has_dialog: false,
          has_description: false,
          has_picture: false,
          has_dialog_audio: false,
          has_description_audio: false,
        };

        mockSituations = [...mockSituations, newItem];
        set({ isCreating: false });
        await get().fetchSituations();
      },

      deleteSituation: async (id: string) => {
        set({ isDeleting: true, error: null });
        await new Promise<void>((resolve) => setTimeout(resolve, 200));
        mockSituations = mockSituations.filter((s) => s.id !== id);
        set({ isDeleting: false });
        await get().fetchSituations();
      },

      fetchSituationDetail: async (id: string) => {
        set({ isLoadingDetail: true, detailError: null });
        await new Promise<void>((resolve) => setTimeout(resolve, 200));

        const situation = mockSituations.find((s) => s.id === id);
        const detail = MOCK_DETAIL_MAP[id];

        if (!situation || !detail) {
          set({
            detailError: 'Situation not found',
            isLoadingDetail: false,
          });
          return;
        }

        const detailResponse: SituationDetailResponse = {
          ...situation,
          updated_at: situation.created_at,
          dialog: detail.dialog,
          description: detail.description,
          picture: detail.picture,
        };

        set({ selectedSituation: detailResponse, isLoadingDetail: false });
      },

      setPage: (page: number) => {
        set({ page });
        get().fetchSituations();
      },

      setCefrFilter: (level: DeckLevel | null) => {
        set({ cefrFilter: level, page: 1 });
        get().fetchSituations();
      },

      setStatusFilter: (status: SituationStatus | null) => {
        set({ statusFilter: status, page: 1 });
        get().fetchSituations();
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query, page: 1 });
        get().fetchSituations();
      },

      setSelectedSituation: (situation: SituationDetailResponse | null) => {
        set({ selectedSituation: situation });
      },

      clearSelectedSituation: () => {
        set({ selectedSituation: null, detailError: null });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'adminSituationStore' }
  )
);

// --- Selectors ---

export const selectSituations = (state: AdminSituationState) => state.situations;
export const selectSelectedSituation = (state: AdminSituationState) => state.selectedSituation;
export const selectIsLoading = (state: AdminSituationState) => state.isLoading;
export const selectIsLoadingDetail = (state: AdminSituationState) => state.isLoadingDetail;
export const selectIsCreating = (state: AdminSituationState) => state.isCreating;
export const selectIsDeleting = (state: AdminSituationState) => state.isDeleting;
export const selectError = (state: AdminSituationState) => state.error;
export const selectDetailError = (state: AdminSituationState) => state.detailError;
export const selectPagination = (state: AdminSituationState) => ({
  page: state.page,
  pageSize: state.pageSize,
  total: state.total,
  totalPages: state.totalPages,
});
export const selectCefrFilter = (state: AdminSituationState) => state.cefrFilter;
export const selectStatusFilter = (state: AdminSituationState) => state.statusFilter;
export const selectSearchQuery = (state: AdminSituationState) => state.searchQuery;
