import { allianzProvider } from "./allianz/provider.js";
import { capitalProvider } from "./capital/provider.js";
import { cathayProvider } from "./cathay/provider.js";
import { ctbcProvider } from "./ctbc/provider.js";
import { fhProvider } from "./fh/provider.js";
import { firstProvider } from "./first/provider.js";
import { jpmorganProvider } from "./jpmorgan/provider.js";
import { nomuraProvider } from "./nomura/provider.js";
import { taishinProvider } from "./taishin/provider.js";
import type { EtfInfo, EtfProvider, ProviderId } from "./types.js";
import { uniPresidentProvider } from "./uniPresident/provider.js";
import { yuantaProvider } from "./yuanta/provider.js";

export const providerRegistry = new Map<ProviderId, EtfProvider>(
  [
    uniPresidentProvider,
    nomuraProvider,
    capitalProvider,
    ctbcProvider,
    cathayProvider,
    yuantaProvider,
    taishinProvider,
    jpmorganProvider,
    fhProvider,
    firstProvider,
    allianzProvider
  ].map((provider) => [provider.providerId, provider])
);

export function getProvider(providerId: ProviderId): EtfProvider {
  const provider = providerRegistry.get(providerId);
  if (!provider) {
    throw new Error(`Provider is not registered: ${providerId}`);
  }

  return provider;
}

export async function getProviderEtfUniverse(): Promise<EtfInfo[]> {
  const lists = await Promise.all([...providerRegistry.values()].map((provider) => provider.getEtfList()));
  return lists.flat();
}

export async function getVerifiedProviderEtfs(): Promise<EtfInfo[]> {
  return (await getProviderEtfUniverse()).filter(
    (etf) => etf.enabled && etf.implementationStatus === "verified"
  );
}
