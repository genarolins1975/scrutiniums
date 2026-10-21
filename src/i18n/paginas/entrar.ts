import type { Idioma } from "@/lib/idioma";
import type { TextosPagina } from "./tipos";

/**
 * Entrada por e-mail e senha e entrada alternativa por código SMS (/entrar,
 * /entrar/sms, /entrar/sms/verificar), inclusive a recuperação de senha
 * (?recuperar=1). O cadastro continua só em português.
 */
const pt = {
  marcaRotulo: "Scrutiniums — página inicial",
  criarAcesso: "Criar acesso",
  termos: "Termos de uso",
  privacidade: "Privacidade",

  // /entrar
  titulo: "Entrar",
  introducaoComDestino: "Os painéis dos observatórios são abertos a quem tem conta. Entre com seu e-mail e senha e você volta direto à página que pediu.",
  introducao: "Use o e-mail e a senha da sua conta.",
  semConta: "Sem conta ainda? O cadastro é gratuito e, ao concluí-lo, você segue para a mesma página.",
  email: "E-mail",
  senha: "Senha",
  erroEmail: "Informe um e-mail válido.",
  erroSenha: "Informe sua senha.",
  entrando: "Entrando…",
  entrar: "Entrar",
  esqueciSenha: "Esqueci minha senha",
  prefereSms: "Prefere entrar sem senha?",
  entrarComSms: "Entrar com código por SMS",
  semCadastro: "Ainda não tenho cadastro",
  erroCredenciais: "E-mail ou senha inválidos.",
  erroMuitasTentativas: "Muitas tentativas. Aguarde um instante e tente novamente.",
  erroEntrar: "Não foi possível entrar agora. Tente novamente.",
  erroEntrarConexao: "Não foi possível entrar agora. Verifique sua conexão.",

  // /entrar/sms
  tituloSms: "Entrar com código por SMS",
  introducaoSms: "Enviamos um código por SMS para o telefone cadastrado.",
  esqueceuSenha: "Esqueceu a senha?",
  recuperarAcesso: "Recuperar acesso",

  // /entrar/sms?recuperar=1 (esqueci minha senha)
  tituloRecuperar: "Recuperar acesso",
  introducaoRecuperar: "Informe o telefone cadastrado. Enviamos um código por SMS e, ao confirmá-lo, você define uma nova senha.",
  pais: "País",
  telefone: "Telefone celular",
  telefonePlaceholder: "Número com DDD",
  erroTelefone: "Informe um telefone válido com DDD.",
  enviando: "Enviando…",
  receberCodigo: "Receber código por SMS",
  entrarComSenha: "Entrar com e-mail e senha",
  erroContinuar: "Não foi possível continuar agora. Tente novamente.",
  erroContinuarConexao: "Não foi possível continuar agora. Verifique sua conexão.",

  // /entrar/sms/verificar
  tituloVerificar: "Código de acesso",
  introducaoVerificar: "Enviamos um código de acesso por SMS ao telefone cadastrado.",
  destinoAntes: "Se houver cadastro para",
  destinoDepois: ", você receberá um código de 6 dígitos por SMS.",
  codigo: "Código recebido por SMS",
  erroCodigoTamanho: "Informe o código de 6 dígitos.",
  erroCodigo: "Código inválido ou expirado.",
  erroVerificar: "Não foi possível verificar agora. Tente novamente.",
  verificando: "Verificando…",
  continuarNovaSenha: "Continuar para nova senha",
  reenviado: "Se o telefone estiver cadastrado, enviamos um novo código por SMS.",
  erroReenviar: "Não foi possível reenviar agora. Tente novamente.",
  alterarTelefone: "Alterar telefone",
  reenviarEm: (segundos: number) => `Reenviar código em ${segundos}s`,
  reenviando: "Reenviando…",
  reenviar: "Reenviar código",
};

const en: TextosPagina<typeof pt> = {
  marcaRotulo: "Scrutiniums home page",
  criarAcesso: "Sign up",
  termos: "Terms of use",
  privacidade: "Privacy",

  titulo: "Sign in",
  introducaoComDestino: "The observatory dashboards are open to account holders. Sign in with your email and password and you go straight back to the page you asked for.",
  introducao: "Use your account email and password.",
  semConta: "No account yet? Signing up is free, and once you finish you continue to the same page.",
  email: "Email",
  senha: "Password",
  erroEmail: "Enter a valid email address.",
  erroSenha: "Enter your password.",
  entrando: "Signing in…",
  entrar: "Sign in",
  esqueciSenha: "Forgot your password?",
  prefereSms: "Prefer to sign in without a password?",
  entrarComSms: "Sign in with an SMS code",
  semCadastro: "I don't have an account yet",
  erroCredenciais: "Invalid email or password.",
  erroMuitasTentativas: "Too many attempts. Wait a moment and try again.",
  erroEntrar: "We couldn't sign you in right now. Try again.",
  erroEntrarConexao: "We couldn't sign you in right now. Check your connection.",

  tituloSms: "Sign in with an SMS code",
  introducaoSms: "We send a code by SMS to the phone number on your account.",
  esqueceuSenha: "Forgot your password?",
  recuperarAcesso: "Recover access",

  tituloRecuperar: "Recover access",
  introducaoRecuperar: "Enter the phone number on your account. We send a code by SMS and, once you confirm it, you set a new password.",
  pais: "Country",
  telefone: "Mobile phone",
  telefonePlaceholder: "Number with area code",
  erroTelefone: "Enter a valid phone number with area code.",
  enviando: "Sending…",
  receberCodigo: "Get a code by SMS",
  entrarComSenha: "Sign in with email and password",
  erroContinuar: "We couldn't continue right now. Try again.",
  erroContinuarConexao: "We couldn't continue right now. Check your connection.",

  tituloVerificar: "Access code",
  introducaoVerificar: "We sent an access code by SMS to the phone number on your account.",
  destinoAntes: "If there is an account for",
  destinoDepois: ", you will receive a 6-digit code by SMS.",
  codigo: "Code received by SMS",
  erroCodigoTamanho: "Enter the 6-digit code.",
  erroCodigo: "Invalid or expired code.",
  erroVerificar: "We couldn't verify the code right now. Try again.",
  verificando: "Verifying…",
  continuarNovaSenha: "Continue to new password",
  reenviado: "If the phone number has an account, we sent a new code by SMS.",
  erroReenviar: "We couldn't resend the code right now. Try again.",
  alterarTelefone: "Change phone number",
  reenviarEm: (segundos: number) => `Resend code in ${segundos}s`,
  reenviando: "Resending…",
  reenviar: "Resend code",
};

export const TEXTOS_ENTRAR: Record<Idioma, TextosPagina<typeof pt>> = { pt, en };
