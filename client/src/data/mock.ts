import type { ChatResponse } from "../types/chat";

const mockData: Record<string, ChatResponse> = {
  "apa itu data pribadi": {
    answer:
      "Berdasarkan Pasal 1 angka 1 UU No. 27 Tahun 2022, Data Pribadi adalah setiap data tentang seseorang yang teridentifikasi atau dapat diidentifikasi secara tersendiri atau dikombinasi dengan informasi lainnya, baik langsung maupun tidak langsung.",
    sources: [
      {
        chunk_id: "uu-27-2022-batang-tubuh-pasal-1-angka-1",
        pasal: "Pasal 1",
        pasal_number: 1,
        ayat: null,
        ayat_number: null,
        text: "Data Pribadi adalah setiap data tentang seseorang yang teridentifikasi atau dapat diidentifikasi secara tersendiri atau dikombinasi dengan informasi lainnya, baik langsung maupun tidak langsung.",
        page_start: 12,
        bab: "BAB I",
        bab_title: "KETENTUAN UMUM",
      },
    ],
  },

  "hak subjek data pribadi": {
    answer:
      "Pasal 14 UU PDP memberikan hak kepada Subjek Data Pribadi, antara lain: hak mengetahui, hak memperoleh akses, hak mengubah, hak menghapus, hak membatasi pemrosesan, hak memindahkan data, hak menolak, dan hak tidak tunduk pada keputusan otomatis.",
    sources: [
      {
        chunk_id: "uu-27-2022-batang-tubuh-pasal-14-ayat-1",
        pasal: "Pasal 14",
        pasal_number: 14,
        ayat: "(1)",
        ayat_number: 1,
        text: "Setiap Subjek Data Pribadi memiliki hak untuk mengetahui dan memperoleh akses atas Data Pribadi miliknya yang sedang dikumpulkan, disimpan, diproses, dan dihasilkan oleh Penguasa Data dan/atau Penyedia Produk Digital.",
        page_start: 25,
        bab: "BAB VII",
        bab_title: "HAK SUBJEK DATA PRIBADI",
      },
    ],
  },

  "siapa yang mengatur": {
    answer:
      "Berdasarkan Pasal 56 UU PDP, dibentuk Lembaga Pengawas Independen yang bertugas mengawasi pemrosesan Data Pribadi dan menegakkan hukum pelindungan data pribadi di Indonesia.",
    sources: [
      {
        chunk_id: "uu-27-2022-batang-tubuh-pasal-56-ayat-1",
        pasal: "Pasal 56",
        pasal_number: 56,
        ayat: "(1)",
        ayat_number: 1,
        text: "Untuk melaksanakan ketentuan Undang-Undang ini, dibentuk Lembaga Pengawas Independen yang dalam melaksanakan tugas dan wewenangnya bersifat independen.",
        page_start: 45,
        bab: "BAB XIV",
        bab_title: "LEMBAGA PENGAWAS INDEPENDEN",
      },
    ],
  },

  "sanksi pelanggaran": {
    answer:
      "Berdasarkan Pasal 67 UU PDP, setiap orang yang dengan sengaja melanggar ketentuan pelindungan data pribadi dapat dipidana dengan pidana penjara paling lama 5 tahun atau denda paling banyak Rp5.000.000.000,00 (lima miliar rupiah).",
    sources: [
      {
        chunk_id: "uu-27-2022-batang-tubuh-pasal-67-ayat-1",
        pasal: "Pasal 67",
        pasal_number: 67,
        ayat: "(1)",
        ayat_number: 1,
        text: "Setiap Orang yang dengan sengaja melanggar ketentuan mengenai pelindungan Data Pribadi sebagaimana dimaksud dalam Pasal 13, Pasal 14, Pasal 15, Pasal 16, Pasal 17, Pasal 18, Pasal 20, dan Pasal 21 dipidana dengan pidana penjara paling lama 5 (lima) tahun dan/atau pidana denda paling banyak Rp5.000.000.000,00 (lima miliar rupiah).",
        page_start: 50,
        bab: "BAB XVI",
        bab_title: "KETENTUAN PIDANA",
      },
    ],
  },

  "kewajiban pemroses data": {
    answer:
      "Berdasarkan Pasal 24 UU PDP, Pemroses Data Pribadi wajib: (1) memproses Data Pribadi sesuai instruksi Penguasa Data; (2) memastikan kerahasiaan Data Pribadi; (3) memberikan pemberitahuan jika terjadi kegagalan perlindungan; dan (4) memelihara integritas keamanan Data Pribadi.",
    sources: [
      {
        chunk_id: "uu-27-2022-batang-tubuh-pasal-24-ayat-1",
        pasal: "Pasal 24",
        pasal_number: 24,
        ayat: "(1)",
        ayat_number: 1,
        text: "Pemroses Data Pribadi wajib memproses Data Pribadi berdasarkan instruksi Penguasa Data.",
        page_start: 30,
        bab: "BAB IX",
        bab_title: "KEWAJIBAN PEMROSES DATA PRIBADI",
      },
    ],
  },
};

const defaultResponse: ChatResponse = {
  answer:
    "Maaf, saya belum memiliki jawaban untuk pertanyaan tersebut dalam mode demo. Silakan coba pertanyaan lain tentang UU PDP, atau nyalakan backend untuk jawaban dari LanceDB + Gemini.",
  sources: [],
};

export function findMockResponse(question: string): ChatResponse {
  const normalized = question.toLowerCase().trim();

  for (const [key, response] of Object.entries(mockData)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return response;
    }
  }

  return defaultResponse;
}
