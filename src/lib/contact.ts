import { supabase } from "@/lib/supabase";

export interface ContactInput {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export type ContactResult =
  | { ok: true }
  | { ok: false; erro: string };

export async function enviarContacto(
  input: ContactInput
): Promise<ContactResult> {
  const { data, error } = await supabase.functions.invoke("contact-form", {
    body: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      message: input.message
    }
  });

  if (error) {
    console.error("[enviarContacto]", error.message);
    return {
      ok: false,
      erro:
        "Não foi possível enviar a mensagem. Tente novamente ou escreva diretamente para geral@palicakes.pt."
    };
  }

  if (!data?.ok) {
    return {
      ok: false,
      erro:
        data?.error ??
        "Não foi possível enviar a mensagem. Tente novamente mais tarde."
    };
  }

  return { ok: true };
}
