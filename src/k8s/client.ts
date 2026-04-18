import * as k8s from "@kubernetes/client-node";

/**
 * Kubernetes client initialised from the in-cluster Service Account.
 *
 * When running inside a cluster, Kubernetes automatically mounts credentials at:
 *   Token : /var/run/secrets/kubernetes.io/serviceaccount/token
 *   CA    : /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
 *
 * The env vars KUBERNETES_SERVICE_HOST / KUBERNETES_SERVICE_PORT point to the
 * API server. `loadFromCluster()` reads all of these automatically.
 *
 * For local development the client falls back to ~/.kube/config.
 */
function buildKubeConfig(): k8s.KubeConfig {
  const kc = new k8s.KubeConfig();

  if (process.env.KUBERNETES_SERVICE_HOST) {
    kc.loadFromCluster();
  } else {
    kc.loadFromDefault();
  }

  return kc;
}

export const kubeConfig = buildKubeConfig();

/** Core API – Pods, Namespaces, Services, … */
export const coreV1Api = kubeConfig.makeApiClient(k8s.CoreV1Api);

/** Apps API – Deployments, ReplicaSets, StatefulSets, … */
export const appsV1Api = kubeConfig.makeApiClient(k8s.AppsV1Api);

/** Generic dynamic client – supports any resource type via discovery */
export const objectApi = k8s.KubernetesObjectApi.makeApiClient(kubeConfig);
