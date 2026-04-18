import * as fs from "node:fs";
import * as k8s from "@kubernetes/client-node";
import { kubeConfig } from "./client.js";
import { logger } from "../logger.js";

export async function runSelfCheck(): Promise<void> {
  logger.info("startup self-check begin");

  checkEndpoint();
  checkCredentials();
  await checkClusterApi();

  logger.info("startup self-check complete");
}

function checkEndpoint(): void {
  const host = process.env.KUBERNETES_SERVICE_HOST;
  if (host) {
    logger.info("kubernetes endpoint: in-cluster", {
      host,
      port: process.env.KUBERNETES_SERVICE_PORT,
    });
    return;
  }

  const cluster = kubeConfig.getCurrentCluster();
  if (cluster?.server) {
    logger.info("kubernetes endpoint: kubeconfig", { server: cluster.server, name: cluster.name });
  } else {
    logger.warn("kubernetes endpoint: none configured");
  }
}

function checkCredentials(): void {
  if (process.env.KUBERNETES_SERVICE_HOST) {
    const tokenPath = "/var/run/secrets/kubernetes.io/serviceaccount/token";
    if (fs.existsSync(tokenPath)) {
      logger.info("credentials: service account token present");
    } else {
      logger.warn("credentials: service account token missing", { path: tokenPath });
    }
    return;
  }

  const user = kubeConfig.getCurrentUser();
  if (user?.name) {
    logger.info("credentials: kubeconfig user present", { user: user.name });
  } else {
    logger.warn("credentials: no kubeconfig user configured");
  }
}

async function checkClusterApi(): Promise<void> {
  try {
    const versionApi = kubeConfig.makeApiClient(k8s.VersionApi);
    const { body } = await versionApi.getCode();
    logger.info("kubernetes api: reachable", {
      gitVersion: body.gitVersion,
      platform: body.platform,
      goVersion: body.goVersion,
    });
  } catch (err) {
    logger.error("kubernetes api: unreachable", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
