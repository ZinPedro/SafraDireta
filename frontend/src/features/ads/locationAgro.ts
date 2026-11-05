import municipiosData from "./municipiosBrasil.json";

export interface EstadoBrasil {
  sigla: string;
  nome: string;
}

export const UFS_BRASIL: EstadoBrasil[] = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

// 1. Dataset completo de todos os 5.571 municípios
export const TODOS_MUNICIPIOS_POR_UF: Record<string, string[]> = municipiosData as Record<string, string[]>;

// 2. Polos em destaque por UF (exibidos como sugestões imediatas quando o campo estiver vazio)
export const POLOS_DESTAQUE_POR_UF: Record<string, string[]> = {
  MG: ["Uberaba", "Uberlândia", "Patrocínio", "Araxá", "Araguari", "Belo Horizonte", "Paracatu", "Unaí", "Passos", "Varginha"],
  SP: ["São Paulo", "Santos", "Campinas", "Barretos", "Ribeirão Preto", "Franca", "Piracicaba", "Presidente Prudente", "São José do Rio Preto", "Araçatuba"],
  GO: ["Rio Verde", "Jataí", "Cristalina", "Goiânia", "Anápolis", "Itumbiara", "Mineiros"],
  MT: ["Sorriso", "Sinop", "Cuiabá", "Rondonópolis", "Lucas do Rio Verde", "Primavera do Leste", "Nova Mutum"],
  MS: ["Dourados", "Campo Grande", "Maracaju", "Três Lagoas", "Ponta Porã", "Naviraí"],
  PR: ["Cascavel", "Londrina", "Maringá", "Curitiba", "Paranaguá", "Toledo", "Castro", "Ponta Grossa"],
  RS: ["Passo Fundo", "Cruz Alta", "Ijuí", "Porto Alegre", "Rio Grande", "Santa Maria", "Uruguaiana"],
  BA: ["Luís Eduardo Magalhães", "Barreiras", "Salvador", "Feira de Santana", "Vitória da Conquista"],
  SC: ["Chapecó", "Concórdia", "Joinville", "Florianópolis", "Xanxerê", "Campos Novos"],
  TO: ["Palmas", "Gurupi", "Araguaína", "Porto Nacional", "Paraíso do Tocantins"],
  MA: ["Balsas", "Imperatriz", "São Luís", "Açailândia", "Grajaú"],
  PI: ["Uruçuí", "Bom Jesus", "Teresina", "Corrente", "Parnaíba"],
  PA: ["Paragominas", "Santarém", "Belém", "Redenção", "Marabá", "Novo Progresso"],
  RO: ["Vilhena", "Ji-Paraná", "Ariquemes", "Porto Velho", "Cacoal"],
  ES: ["Linhares", "Colatina", "Vitória", "São Mateus", "Cachoeiro de Itapemirim"],
  DF: ["Brasília", "Brazlândia", "Planaltina", "Paranoá", "Gama"],
  RJ: ["Campos dos Goytacazes", "Resende", "Rio de Janeiro", "Itaperuna", "Petrópolis"],
};

export const MUNICIPIOS_AGRO_POR_UF = TODOS_MUNICIPIOS_POR_UF;

export const REGIOES_AGRO_POR_UF: Record<string, string[]> = {
  MG: [
    "Triângulo Mineiro",
    "Alto Paranaíba",
    "Sul de Minas",
    "Noroeste de Minas",
    "Zona da Mata",
    "Norte de Minas",
    "Centro-Oeste de Minas",
    "Vale do Jequitinhonha",
    "Vale do Rio Doce",
  ],
  SP: [
    "Alta Mogiana",
    "Alta Paulista",
    "Vale do Paranapanema",
    "Mogiana",
    "Ribeirão Preto e Região",
    "Noroeste Paulista",
    "Sudoeste Paulista",
    "Pontal do Paranapanema",
    "Bauru e Região",
    "Central Paulista",
  ],
  GO: [
    "Sudoeste Goiano",
    "Entorno do DF",
    "Sul Goiano",
    "Norte Goiano",
    "Vale do São Patrício",
    "Estrada de Ferro",
    "Oeste Goiano",
    "Nordeste Goiano",
  ],
  MT: [
    "Médio-Norte",
    "Vale do Teles Pires",
    "Sudeste Matogrossense",
    "Norte Araguaia",
    "Oeste Matogrossense",
    "Parecis",
    "Vale do Araguaia",
    "Centro-Sul",
    "Norte Matogrossense",
  ],
  MS: [
    "Sul-Fronteira",
    "Centro-Sul",
    "Bolsão Sul-Mato-Grossense",
    "Pantanal Sul-Mato-Grossense",
    "Norte de MS",
    "Grande Dourados",
  ],
  PR: [
    "Norte Pioneiro",
    "Norte Central",
    "Oeste Paranaense",
    "Campos Gerais",
    "Sudoeste Paranaense",
    "Centro-Sul",
    "Noroeste Paranaense",
  ],
  RS: [
    "Planalto Médio",
    "Missões",
    "Campanha Gaúcha",
    "Fronteira Oeste",
    "Serra Gaúcha",
    "Metade Sul",
    "Alto Uruguai",
    "Litoral Norte",
  ],
  BA: [
    "Oeste Baiano (Cerrado)",
    "Vale do São Francisco",
    "Chapada Diamantina",
    "Recôncavo",
    "Sudoeste Baiano",
    "Litoral Sul (Cacau)",
    "Irecê e Região",
  ],
  TO: [
    "MATOPIBA",
    "Centro-Norte",
    "Sul do Tocantins",
    "Vale do Araguaia",
    "Sudeste do Tocantins",
  ],
  RO: [
    "Cone Sul",
    "Vale do Guaporé",
    "Central",
    "Norte Rondoniense",
    "Vale do Jamari",
  ],
  MA: [
    "Sul do Maranhão (MATOPIBA)",
    "Cerrado Maranhense",
    "Vale do Pindaré",
    "Baixada Maranhense",
    "Leste Maranhense",
  ],
  PI: [
    "Cerrados Piauienses (MATOPIBA)",
    "Gurgueia",
    "Vale do Canindé",
    "Litoral Piauiense",
    "Médio Parnaíba",
  ],
  PA: [
    "Sul do Pará",
    "Nordeste Paraense",
    "Baixo Amazonas",
    "Marajó",
    "Sudoeste Paraense",
  ],
  SC: [
    "Oeste Catarinense",
    "Meio-Oeste",
    "Planalto Serrano",
    "Alto Vale do Itajaí",
    "Sul Catarinense",
    "Planalto Norte",
  ],
  ES: [
    "Norte Capixaba",
    "Região Serrana",
    "Caparaó",
    "Litoral Sul",
    "Central",
  ],
  CE: [
    "Ibiapaba",
    "Cariri",
    "Sertão Central",
    "Vale do Jaguaribe",
    "Maciço de Baturité",
  ],
  AL: [
    "Agreste Alagoano",
    "Sertão Alagoano",
    "Zona da Mata Alagoana",
    "Litoral Norte",
  ],
  SE: [
    "Agreste Sergipano",
    "Sertão Sergipano",
    "Leste Sergipano",
    "Baixo São Francisco",
  ],
  PB: [
    "Brejo Paraibano",
    "Borborema",
    "Sertão Paraibano",
    "Agreste Paraibano",
    "Litoral Paraibano",
  ],
  PE: [
    "Vale do São Francisco",
    "Agreste Pernambucano",
    "Sertão do Araripe",
    "Zona da Mata Pernambucana",
    "Sertão do Moxotó",
  ],
  RN: [
    "Oeste Potiguar",
    "Agreste Potiguar",
    "Sertão do Seridó",
    "Litoral Potiguar",
  ],
  AC: [
    "Vale do Acre",
    "Vale do Juruá",
  ],
  AP: [
    "Sul do Amapá",
    "Norte do Amapá",
  ],
  AM: [
    "Sul do Amazonas",
    "Baixo Amazonas",
    "Médio Amazonas",
  ],
  RR: [
    "Região Central",
    "Norte de Roraima",
    "Sul de Roraima",
  ],
  DF: [
    "Polo Agrícola do DF",
    "PRODECER / PAD-DF",
    "Brazlândia / Morango",
    "Planaltina / Grãos",
  ],
  RJ: [
    "Norte Fluminense",
    "Noroeste Fluminense",
    "Região Serrana",
    "Médio Paraíba",
  ],
};

function normalizarTexto(txt: string): string {
  return txt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function obterTodosMunicipiosPorUf(uf: string): string[] {
  if (!uf) return [];
  const ufUpper = uf.trim().toUpperCase();
  return TODOS_MUNICIPIOS_POR_UF[ufUpper] || [];
}

export function obterPolosDestaque(uf: string): string[] {
  if (!uf) return [];
  const ufUpper = uf.trim().toUpperCase();
  return POLOS_DESTAQUE_POR_UF[ufUpper] || (TODOS_MUNICIPIOS_POR_UF[ufUpper]?.slice(0, 10) || []);
}

// Compatibilidade retroativa
export function obterMunicipiosSugeridos(uf: string): string[] {
  return obterPolosDestaque(uf);
}

export function obterRegioesSugeridas(uf: string): string[] {
  if (!uf) return [];
  const ufUpper = uf.trim().toUpperCase();
  return REGIOES_AGRO_POR_UF[ufUpper] || [];
}

// 4. Validação oficial: Qualquer um dos 5.571 municípios da UF é 100% válido
export function verificarMunicipioValido(cidade: string, uf: string): boolean {
  if (!cidade || !uf) return false;
  const lista = obterTodosMunicipiosPorUf(uf);
  if (lista.length === 0) return true;

  const cidadeNorm = normalizarTexto(cidade);
  return lista.some((item) => normalizarTexto(item) === cidadeNorm);
}
