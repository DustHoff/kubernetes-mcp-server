# Kubernetes MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes Kubernetes cluster operations as tools. The server is designed to run **inside** a Kubernetes cluster and authenticates against the Kubernetes API using the Service Account automatically mounted into the pod.

---

## Available Tools

| Tool | Description |
|---|---|
| `list_namespaces` | List all namespaces in the cluster |
| `list_pods` | List pods in a namespace, with optional label selector |
| `get_pod_logs` | Retrieve logs from a pod container |
| `list_deployments` | List Deployments in a namespace |
| `scale_deployment` | Scale a Deployment to a desired replica count |
| `list_services` | List Services in a namespace |

---

## Architecture

```
┌──────────────────────────────┐
│        Kubernetes Cluster    │
│                              │
│  ┌─────────────────────────┐ │
│  │  MCP Server Pod         │ │
│  │                         │ │
│  │  [Node.js Process]      │ │
│  │    ↕ stdio (MCP)        │ │
│  │                         │ │
│  │  ServiceAccount Token   │ │
│  │  (auto-mounted)         │ │
│  └──────────┬──────────────┘ │
│             │                │
│             ▼                │
│  ┌──────────────────────┐    │
│  │  Kubernetes API      │    │
│  │  Server              │    │
│  └──────────────────────┘    │
└──────────────────────────────┘
```

### Authentication

When the pod starts, Kubernetes automatically mounts the Service Account credentials at:

| Path | Content |
|---|---|
| `/var/run/secrets/kubernetes.io/serviceaccount/token` | Bearer token for API authentication |
| `/var/run/secrets/kubernetes.io/serviceaccount/ca.crt` | CA certificate to verify the API server |
| `/var/run/secrets/kubernetes.io/serviceaccount/namespace` | The namespace the pod is running in |

The environment variables `KUBERNETES_SERVICE_HOST` and `KUBERNETES_SERVICE_PORT` point to the API server. The server detects these at startup and calls `loadFromCluster()` automatically.

For **local development**, the server falls back to `~/.kube/config`.

---

## Kubernetes Setup

### 1. Service Account & RBAC

Create the Service Account and grant it the required permissions. Adjust the `verbs` to follow the principle of least privilege.

```yaml
# rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kubernetes-mcp-server
  namespace: default

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kubernetes-mcp-server
rules:
  # Core resources
  - apiGroups: [""]
    resources: ["namespaces", "pods", "pods/log", "services"]
    verbs: ["get", "list", "watch"]
  # Apps resources
  - apiGroups: ["apps"]
    resources: ["deployments", "deployments/scale"]
    verbs: ["get", "list", "watch", "patch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kubernetes-mcp-server
subjects:
  - kind: ServiceAccount
    name: kubernetes-mcp-server
    namespace: default
roleRef:
  kind: ClusterRole
  name: kubernetes-mcp-server
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl apply -f rbac.yaml
```

### 2. Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubernetes-mcp-server
  namespace: default
  labels:
    app: kubernetes-mcp-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kubernetes-mcp-server
  template:
    metadata:
      labels:
        app: kubernetes-mcp-server
    spec:
      serviceAccountName: kubernetes-mcp-server   # ← binds the Service Account

      # Restrict pod permissions
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000

      containers:
        - name: mcp-server
          image: ghcr.io/<your-org>/kubernetes-mcp-server:latest
          imagePullPolicy: Always

          # MCP communicates over stdio – no HTTP port needed
          stdin: true
          tty: false

          env:
            - name: NODE_ENV
              value: production

          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi

          # Read-only root filesystem for security
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
```

```bash
kubectl apply -f deployment.yaml
```

---

## Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run (uses ~/.kube/config)
npm start

# Watch mode
npm run dev

# Lint
npm run lint
```

---

## CI/CD

GitHub Actions runs on every push and pull request:

1. **Build & Lint** — TypeScript compilation + ESLint across Node 18, 20, and 22
2. **Docker Build & Push** — Multi-platform image (`linux/amd64` + `linux/arm64`) pushed to `ghcr.io`

Tag a release to publish a versioned image:

```bash
git tag v1.0.0
git push origin v1.0.0
# → builds and pushes ghcr.io/<org>/kubernetes-mcp-server:v1.0.0 and :latest
```

---

## Project Structure

```
src/
├── index.ts              # MCP server entry point
├── k8s/
│   └── client.ts         # Kubernetes API client (in-cluster / kubeconfig)
├── tools/
│   ├── index.ts          # Tool registry & dispatcher
│   ├── namespaces.ts     # list_namespaces
│   ├── pods.ts           # list_pods, get_pod_logs
│   ├── deployments.ts    # list_deployments, scale_deployment
│   └── services.ts       # list_services
└── resources/
    └── index.ts          # MCP resource registry
```

---

## License

MIT
