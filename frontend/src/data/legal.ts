export interface LegalSection {
  id: string;
  title: string;
  content: string[];
  bulletPoints?: string[];
  alert?: string;
  contentExtra?: string;
}

export interface LegalDocument {
  title: string;
  subtitle: string;
  version: string;
  lastUpdated: string;
  introduction: string;
  sections: LegalSection[];
}

export const termsOfUse: LegalDocument = {
  title: "Termos de Uso",
  subtitle: "Condições gerais de navegação, cadastro e comercialização na plataforma SafraDireta",
  version: "1.0",
  lastUpdated: "08 de outubro de 2026",
  introduction:
    "Bem-vindo ao SafraDireta. Estes Termos de Uso regem o acesso, cadastro e a utilização do marketplace digital SafraDireta, desenvolvido como projeto acadêmico do curso de Engenharia da Computação da PUC-Campinas. Ao acessar a plataforma ou criar uma conta, você declara ter lido, compreendido e aceito integralmente as condições aqui descritas.",
  sections: [
    {
      id: "objeto",
      title: "1. Objeto e Natureza da Plataforma",
      content: [
        "O SafraDireta é uma plataforma tecnológica de aproximação direta no agronegócio, voltada à conexão entre produtores rurais e compradores comerciais (cooperativas, torrefações, indústrias de beneficiamento e cerealistas).",
        "A plataforma viabiliza a divulgação e negociação de lotes das culturas de café, boi gordo, soja e milho, promovendo transparência comercial e redução de intermediários.",
        "O SafraDireta atua como facilitador tecnológico do ecossistema agrícola e não assume a titularidade, posse ou guarda física das safras anunciadas, salvo previsão expressa em contrário.",
      ],
    },
    {
      id: "contas",
      title: "2. Modelo de Contas e Identidade Única",
      content: [
        "O SafraDireta adota o princípio de Conta Única (Single Identity). Cada usuário possui uma única identidade de acesso vinculada a um e-mail verificado, podendo operar tanto na compra quanto na venda na mesma conta.",
      ],
      bulletPoints: [
        "Conta Pessoa Física (PF): Destinada a produtores individuais e compradores pessoas físicas. Nasce habilitada para navegação e compra. A habilitação para venda exige fornecimento de CPF, informações da propriedade rural e envio de documento comprobatório.",
        "Conta Corporativa (PJ): Destinada a pessoas jurídicas (cooperativas, agroindústrias e empresas). O cadastro exige CNPJ ativo, razão social, endereço da sede, designação de representante legal com poderes e submissão documental. Transações de compra e venda por PJ dependem de prévia validação cadastral manual pela equipe da plataforma.",
        "Responsabilidade por Credenciais: O usuário é o único responsável pela guarda e confidencialidade de sua senha. No caso de contas corporativas, o compartilhamento interno de credenciais entre operadores da empresa é de inteira responsabilidade da pessoa jurídica cadastrada.",
      ],
      alert:
        "É terminantemente proibida a criação de cadastros duplicados com o mesmo CPF, CNPJ ou e-mail, bem como o uso de dados de terceiros sem a devida procuração legal.",
    },
    {
      id: "habilitacao",
      title: "3. Habilitação de Vendedores e Análise Documental",
      content: [
        "Para anunciar e comercializar safras no SafraDireta, o usuário deve submeter seu perfil à habilitação de vendedor.",
        "A habilitação para produtor pessoa física exige CPF regular, nome e localização da fazenda, indicação das culturas produzidas e upload de documento oficial com foto. A inscrição no Cadastro Ambiental Rural (CAR) ou Inscrição Estadual é incentivada para concessão de selos de produtor verificado.",
        "Para contas PJ, a submissão inclui Contrato Social/CCMEI e comprovação de poderes do representante legal. A análise é conduzida de forma manual pela equipe do SafraDireta, reservando-se o direito de solicitar correções ou rejeitar cadastros com inconsistências.",
      ],
    },
    {
      id: "comercializacao",
      title: "4. Regras de Comercialização e Compra de Lote Inteiro",
      content: [
        "No estágio atual (MVP) do SafraDireta, todas as operações de compra direta são efetuadas sobre o lote integral anunciado, sendo vedado o fracionamento do lote em volumes inferiores aos estipulados pelo vendedor.",
        "O fluxo transacional oficial do marketplace compreende as seguintes etapas sequenciais:",
      ],
      bulletPoints: [
        "Seleção do lote e inclusão no carrinho de compra;",
        "Formulação do pedido de compra pelo comprador interessado;",
        "Definição da modalidade logística e cotação de frete;",
        "Confirmação expressa de disponibilidade e aceite pelo vendedor;",
        "Processamento seguro de pagamento através dos meios homologados na plataforma;",
        "Conclusão da negociação e atualização automática do status do anúncio para VENDIDO.",
      ],
    },
    {
      id: "negociacao-chat",
      title: "5. Comunicação no Chat e Limite de Responsabilidade",
      content: [
        "A plataforma disponibiliza canal de chat aberto para que compradores e vendedores tirem dúvidas sobre especificações de safra, laudos de classificação, umidade, peneira, lote e logística de retirada.",
        "As partes têm plena liberdade para dialogar e esclarecer detalhes técnicos da negociação.",
      ],
      alert:
        "AVISO IMPORTANTE: Quaisquer pagamentos, transferências bancárias, adiantamentos ou acordos de preço e transporte realizados pelas partes FORA do fluxo oficial da plataforma ocorrem sob inteira e exclusiva responsabilidade e risco dos negociantes. O SafraDireta não garante, não fiscaliza e não se responsabiliza por acordos informais ou transações paralelas não processadas pelo sistema.",
    },
    {
      id: "logistica",
      title: "6. Transporte, Logística e Retirada de Carga",
      content: [
        "O vendedor deve informar em seu cadastro e anúncio a sua capacidade logística, indicando se possui frota/transporte próprio ou se a retirada é por conta do comprador / transportadora contratada.",
        "A conferência da carga, aferição de pesagem e inspeção fitossanitária no ato do carregamento e descarregamento cabem exclusivamente às partes envolvidas e aos operadores logísticos contratados.",
      ],
    },
    {
      id: "conduta",
      title: "7. Uso Aceitável e Sanções",
      content: [
        "O usuário compromete-se a utilizar o SafraDireta em estrita observância da legislação brasileira e da boa-fé comercial, sendo expressamente proibido:",
      ],
      bulletPoints: [
        "Publicar anúncios fictícios, safras inexistentes ou produtos em desacordo com as normas do Ministério da Agricultura e Pecuária (MAPA);",
        "Utilizar linguagem ofensiva, discriminatória ou abusiva nos canais de comunicação;",
        "Tentar burlar sistemas de segurança, praticar engenharia reversa ou sobrecarregar a infraestrutura técnica do serviço;",
        "Divulgar informações enganosas a respeito da qualidade, peso, variedade ou procedência dos produtos.",
      ],
      contentExtra:
        "O descumprimento de qualquer disposição sujeitará o infrator ao cancelamento de anúncios, suspensão de habilitação de vendedor ou encerramento definitivo da conta, sem prejuízo das medidas cíveis e criminais cabíveis.",
    },
    {
      id: "disposicoes-gerais",
      title: "8. Disposições Gerais e Foro",
      content: [
        "O SafraDireta reserva-se o direito de atualizar estes Termos de Uso periodicamente para refletir evoluções do produto ou exigências legais. Alterações substanciais serão comunicadas aos usuários cadastrados.",
        "Por se tratar de iniciativa desenvolvida no âmbito acadêmico da PUC-Campinas, a plataforma prioriza o aprimoramento contínuo e a segurança dos testes funcionais.",
        "Estes termos são regidos pelas leis da República Federativa do Brasil, elegendo-se o Foro da Comarca de Campinas, Estado de São Paulo, para dirimir eventuais controvérsias.",
      ],
    },
  ],
};

export const privacyPolicy: LegalDocument = {
  title: "Política de Privacidade",
  subtitle: "Diretrizes de transparência, proteção e tratamento de dados pessoais no SafraDireta (LGPD)",
  version: "1.0",
  lastUpdated: "08 de outubro de 2026",
  introduction:
    "A sua privacidade e a segurança dos seus dados são prioridades fundamentais no SafraDireta. Esta Política de Privacidade descreve de forma clara como tratamos, armazenamos e protegemos seus dados pessoais e empresariais, em estrita conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD) e com o Marco Civil da Internet (Lei nº 12.965/2014).",
  sections: [
    {
      id: "dados-coletados",
      title: "1. Dados Coletados e Finalidades do Tratamento",
      content: [
        "Coletamos apenas os dados estritamente necessários para permitir o funcionamento regular do marketplace e a segurança das negociações agrícolas:",
      ],
      bulletPoints: [
        "Dados Cadastrais de Pessoa Física: Nome completo, e-mail de acesso, telefone de contato/recuperação, hash seguro de senha, CPF (exigido para habilitação de vendedor) e documentos de identificação com foto.",
        "Dados Cadastrais de Pessoa Jurídica: Razão social, CNPJ, nome fantasia, natureza jurídica, endereço da sede, dados do representante legal (nome, CPF, cargo/vínculo) e documentos comprobatórios de constituição empresarial.",
        "Dados de Propriedade e Produção: Nome da fazenda/propriedade rural, município e estado de localização, tipos de culturas comercializadas (café, boi gordo, soja, milho) e declaração de capacidade de transporte.",
        "Dados Técnicos e de Navegação: Endereço IP, data e hora de conexões, identificadores de sessão revogáveis e registros de auditoria interna para prevenção a fraudes.",
      ],
    },
    {
      id: "segregacao",
      title: "2. Segregação entre Dados Privados e Vitrine Pública",
      content: [
        "O SafraDireta adota o princípio da privacidade por design (Privacy by Design). Existe separação arquitetural rigorosa entre o que é confidencial e o que é exibido no mercado:",
      ],
      bulletPoints: [
        "Dados Estritamente Privados: Senhas (armazenadas exclusivamente como hashes criptográficos irreversíveis), documentos de identidade/contratos sociais submetidos, CPF completo do produtor, telefone privado de recuperação de conta e endereço residencial completo NUNCA são expostos em páginas públicas.",
        "Dados da Vitrine Pública do Vendedor: Os compradores no catálogo têm acesso apenas a: Nome da Propriedade Rural, Município/UF da safra, tipos de culturas ativas, bio descritiva da fazenda e o Telefone Comercial Público que o vendedor informou voluntariamente para atendimento a clientes.",
      ],
      alert:
        "O telefone privado de recuperação da conta permanece sob sigilo absoluto e nunca é misturado com o telefone de contato comercial da fazenda.",
    },
    {
      id: "base-legal",
      title: "3. Bases Legais para o Tratamento (LGPD)",
      content: [
        "O tratamento de dados pessoais no SafraDireta fundamenta-se nas seguintes bases legais estabelecidas no Art. 7º da LGPD:",
      ],
      bulletPoints: [
        "Execução de contrato e procedimentos preliminares (Art. 7º, V): Para viabilizar a criação de contas, navegação, processamento de pedidos e emissão de avisos transacionais.",
        "Cumprimento de obrigação legal ou regulatória (Art. 7º, II): Para guarda de registros de acesso em conformidade com o Marco Civil da Internet.",
        "Legítimo interesse (Art. 7º, IX): Para aprimoramento dos serviços, segurança da informação e prevenção a acessos indevidos e condutas fraudulentas.",
      ],
    },
    {
      id: "armazenamento-seguranca",
      title: "4. Armazenamento, Segurança e Retenção",
      content: [
        "Adotamos medidas técnicas e administrativas aptas a proteger os dados pessoais contra acessos não autorizados, vazamentos ou perda acidental:",
      ],
      bulletPoints: [
        "Senhas criptografadas com algoritmos de hash com sal (salting/hashing) de padrão moderno;",
        "Tráfego protegido com protocolo HTTPS / TLS em todas as comunicações;",
        "Armazenamento privado e restrito para imagens e arquivos submetidos na verificação cadastral;",
        "Sessões de acesso revogáveis e autenticação de operadores administrativos com registro de auditoria.",
      ],
      contentExtra:
        "Os dados são retidos durante o período em que a conta do usuário permanecer ativa ou pelo prazo necessário para cumprimento de obrigações legais, fiscais e regulatórias.",
    },
    {
      id: "compartilhamento",
      title: "5. Compartilhamento de Dados com Terceiros",
      content: [
        "O SafraDireta NÃO vende, aluga ou comercializa dados pessoais com anunciantes ou terceiros sob nenhuma hipótese.",
        "O compartilhamento de dados ocorre de forma controlada apenas nas seguintes circunstâncias:",
      ],
      bulletPoints: [
        "Entre Comprador e Vendedor: Quando uma proposta de compra é formalizada e aceita, os dados de contato necessários para o cumprimento da operação comercial e frete são compartilhados entre os envolvidos na transação;",
        "Autoridades Públicas: Mediante ordem judicial fundamentada ou solicitação de autoridade competente no exercício regular de suas atribuições legais.",
      ],
    },
    {
      id: "direitos-titular",
      title: "6. Direitos do Titular de Dados",
      content: [
        "Em conformidade com o Art. 18 da LGPD, você, enquanto titular de dados, possui o direito de solicitar a qualquer momento:",
      ],
      bulletPoints: [
        "Confirmação da existência de tratamento dos seus dados pessoais;",
        "Acesso facilitado aos seus dados cadastrais;",
        "Correção de dados incompletos, inexatos ou desatualizados através da página de Perfil;",
        "Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;",
        "Eliminação definitiva dos dados pessoais tratados com consentimento, ressalvadas as hipóteses de guarda obrigatória por lei.",
      ],
    },
    {
      id: "contato-dpo",
      title: "7. Canal de Contato do Encarregado de Dados (DPO)",
      content: [
        "Para exercer qualquer um dos seus direitos, esclarecer dúvidas sobre esta Política de Privacidade ou solicitar informações sobre o tratamento de dados pessoais, entre em contato com a equipe gestora do SafraDireta através da opção 'Fale com a gente' disponível na plataforma ou pelos canais institucionais do projeto na PUC-Campinas.",
        "Esta política entra em vigor a partir da data de sua publicação.",
      ],
    },
  ],
};
