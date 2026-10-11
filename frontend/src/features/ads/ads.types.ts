export type AnimalSpecies = "BOVINO" | "SUINO" | "OVINO" | "EQUINO";

export type AnimalPurpose =
  | "ENGORDA_ABATE"
  | "RECRIA_GARROTES"
  | "CRIA_DESMAMA"
  | "REPRODUCAO_TOUROS"
  | "CRIA"
  | "RECRIA"
  | "REPRODUCAO";

export type PricingMode = "TOTAL" | "PER_HEAD";

export type AdStatus = "ATIVO" | "PAUSADO" | "VENDIDO";

export interface AnimalLotAd {
  id: string;
  vendedorId: string;
  vendedorNome: string;
  vendedorAvatar?: string;
  farmName: string;
  titulo: string;
  descricao?: string;
  categoria: "ANIMAL";
  especie: AnimalSpecies;
  raca: string;
  quantidadeCabecas: number;
  finalidade: AnimalPurpose;
  idadeMeses?: number;
  pesoMedioKg: number;
  pesoMedioArroba: number;
  pesoTotalKg: number;
  pesoTotalArroba: number;
  precoTotal: number;
  precoPorCabeca: number;
  precoPorArroba: number;
  cidade: string;
  uf: string;
  imagemUrl: string;
  criadoEm: string;
  status: AdStatus;
  seloVerificado?: boolean;
}

export interface CreateAnimalAdInput {
  titulo: string;
  descricao?: string;
  especie: AnimalSpecies;
  raca: string;
  quantidadeCabecas: number;
  finalidade: AnimalPurpose;
  idadeMeses?: number;
  pesoMedioKg: number;
  pricingMode: PricingMode;
  precoTotal?: number;
  precoPorCabeca?: number;
  cidade: string;
  uf: string;
}

export const SPECIES_LABELS: Record<AnimalSpecies, string> = {
  BOVINO: "Bovino (Boi Gordo)",
  SUINO: "Suíno",
  OVINO: "Ovino",
  EQUINO: "Equino",
};

export const BEEF_CATTLE_PURPOSES: { value: AnimalPurpose; label: string }[] = [
  { value: "ENGORDA_ABATE", label: "Engorda / Terminação / Boi Gordo" },
  { value: "RECRIA_GARROTES", label: "Recria / Garrotes" },
  { value: "CRIA_DESMAMA", label: "Cria / Bezerros / Desmama" },
  { value: "REPRODUCAO_TOUROS", label: "Touros / Reprodutores" },
];

export const PURPOSE_LABELS: Record<AnimalPurpose, string> = {
  ENGORDA_ABATE: "Boi Gordo / Terminação / Abate",
  RECRIA_GARROTES: "Recria / Garrotes",
  CRIA_DESMAMA: "Cria / Bezerros / Desmama",
  REPRODUCAO_TOUROS: "Touros / Reprodutores",
  CRIA: "Cria / Bezerros",
  RECRIA: "Recria / Garrotes",
  REPRODUCAO: "Touros / Reprodutores",
};

export interface BreedOption {
  value: string;
  label: string;
}

export const BEEF_CATTLE_BREEDS: BreedOption[] = [
  { value: "Nelore", label: "Nelore" },
  { value: "Angus (Aberdeen Angus)", label: "Angus (Aberdeen Angus)" },
  { value: "Brangus", label: "Brangus" },
  { value: "Cruzamento Industrial F1", label: "Cruzamento Industrial F1" },
  { value: "Senepol", label: "Senepol" },
  { value: "Brahman", label: "Brahman" },
  { value: "Tabapuã", label: "Tabapuã" },
  { value: "Guzerá", label: "Guzerá" },
  { value: "Hereford / Braford", label: "Hereford / Braford" },
  { value: "Anelorado / Mestiço", label: "Anelorado / Mestiço" },
  { value: "OUTRA", label: "Outra raça / Cruzamento específico" },
];

export const COMMON_BREEDS = BEEF_CATTLE_BREEDS.map((b) => b.value);
