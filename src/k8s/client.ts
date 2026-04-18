import {
  KubeConfig,
  CoreV1Api,
  AppsV1Api,
} from "@kubernetes/client-node";

/**
 * Kubernetes client initialised from the in-cluster Service Account.
 *
 * When the pod runs inside a Kubernetes cluster, the API server address and
 * the bearer token are automatically available at well-known paths:
 *
 *   Token : /var/run/secrets/kubernetes.io/serviceaccount/token
 *   CA    : /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
 *   Host  : KUBERNETES_SERVICE_HOST / KUBERNETES_SERVICE_PORT env vars
 *
 * `loadFromCluster()` reads all of these automatically.
 * For local development, fall back to the default kubeconfig file.
 */
function buildKubeConfig(): KubeConfig {
  const kc = new KubeConfig();

  if (process.env.KUBERNETES_SERVICE_HOST) {
    // Running inside a cluster → use the mounted Service Account credentials
    kc.loadFromCluster();
  } else {
    // Local development → use ~/.kube/config
    kc.loadFromDefault();
  }

  return kc;
}

const kubeConfig = buildKubeConfig();

/** Core API – Pods, Namespaces, Services, ConfigMaps, … */
export const coreV1Api = kubeConfig.makeApiClient(CoreV1Api);

/** Apps API – Deployments, ReplicaSets, StatefulSets, DaemonSets, … */
export const appsV1Api = kubeConfig.makeApiClient(AppsV1Api);
