import { storage } from "./storage";

export const melhorEnvioService = {
  getValidToken: async () => {
    const settings = await storage.getSettings();
    if (!settings) return { token: null, env: "sandbox" };

    const env = settings.melhorEnvioEnvironment || "sandbox";
    let token =
      env === "production"
        ? settings.melhorEnvioProdToken
        : settings.melhorEnvioSandboxToken;
    const expiresAt =
      env === "production"
        ? settings.melhorEnvioProdExpiresAt
        : settings.melhorEnvioSandboxExpiresAt;
    const refreshToken =
      env === "production"
        ? settings.melhorEnvioProdRefreshToken
        : settings.melhorEnvioSandboxRefreshToken;

    if (expiresAt && Date.now() > expiresAt - 300000 && refreshToken) {
      console.log("Token is expired or expiring soon, refreshing...");
      const clientId =
        env === "production"
          ? settings.melhorEnvioProdClientId
          : settings.melhorEnvioSandboxClientId;
      const clientSecret =
        env === "production"
          ? settings.melhorEnvioProdClientSecret
          : settings.melhorEnvioSandboxClientSecret;

      const refreshRes = await fetch("/api/melhorenvio/oauth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshToken,
          clientId,
          clientSecret,
          environment: env,
        }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newSettings: any = { ...settings };
        if (env === "production") {
          newSettings.melhorEnvioProdToken = refreshData.access_token;
          newSettings.melhorEnvioProdRefreshToken = refreshData.refresh_token;
          newSettings.melhorEnvioProdExpiresAt =
            Date.now() + refreshData.expires_in * 1000;
        } else {
          newSettings.melhorEnvioSandboxToken = refreshData.access_token;
          newSettings.melhorEnvioSandboxRefreshToken =
            refreshData.refresh_token;
          newSettings.melhorEnvioSandboxExpiresAt =
            Date.now() + refreshData.expires_in * 1000;
        }
        await storage.saveSettings(newSettings);
        token = refreshData.access_token;
      }
    }

    return { token: token || null, env };
  },
  calculateShipping: async (data: any) => {
    console.log("Melhor Envio API integration placeholder", data);
    return { price: 0, deadline: 0 };
  },
};
