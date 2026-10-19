export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { jadwalkanPembaruan } = await import("./lib/pembaruan");
    jadwalkanPembaruan();
  }
}
