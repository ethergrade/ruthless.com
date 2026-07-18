import type { Technology } from '../types';

/**
 * T — The Technology Book.
 * Real-world CI/CD & cloud stacks (invented=false) plus ruthless.com-inspired
 * FUTURISTIC techs (invented=true) that DEV departments can master vertically.
 * Consultable by the player via the Technologies tab in the bottom panel.
 */
export const TECHNOLOGIES: Technology[] = [
  // ---- CI/CD (real-world) ----
  { id: 'cicd_github', name: 'GitHub Actions', category: 'cicd', tier: 1, invented: false, skill: 'pipeline_automation', description: 'YAML-driven CI/CD pipelines: build, test, deploy on every push.' },
  { id: 'cicd_gitlab', name: 'GitLab CI', category: 'cicd', tier: 1, invented: false, skill: 'pipeline_automation', description: 'Integrated CI/CD with review apps and auto-devops.' },
  { id: 'cicd_circle', name: 'CircleCI', category: 'cicd', tier: 2, invented: false, skill: 'pipeline_automation', description: 'Fast container-native pipelines with parallelism & orbs.' },
  { id: 'cicd_argo', name: 'ArgoCD', category: 'cicd', tier: 3, invented: false, skill: 'gitops', description: 'GitOps continuous delivery for Kubernetes — declarative sync.' },
  { id: 'cicd_tekton', name: 'Tekton', category: 'cicd', tier: 3, invented: false, skill: 'pipeline_as_code', description: 'Cloud-native pipelines as Kubernetes CRDs.' },

  // ---- Cloud ----
  { id: 'cloud_k8s', name: 'Kubernetes', category: 'cloud', tier: 2, invented: false, skill: 'orchestration', description: 'Container orchestration at planet scale.' },
  { id: 'cloud_terraform', name: 'Terraform', category: 'cloud', tier: 2, invented: false, skill: 'iac', description: 'Infrastructure as code across every cloud.' },
  { id: 'cloud_serverless', name: 'Serverless / FaaS', category: 'cloud', tier: 3, invented: false, skill: 'event_driven', description: 'Scale-to-zero functions; pay per invocation.' },

  // ---- AI ----
  { id: 'ai_mlops', name: 'MLOps', category: 'ai', tier: 3, invented: false, skill: 'model_ops', description: 'Train → deploy → monitor ML models in production.' },
  { id: 'ai_llmops', name: 'LLMOps', category: 'ai', tier: 4, invented: false, skill: 'model_ops', description: 'Operate foundation-model apps: eval, guardrails, fine-tunes.' },

  // ---- Security ----
  { id: 'sec_zerotrust', name: 'Zero Trust', category: 'security', tier: 3, invented: false, skill: 'security_arch', description: 'Never trust, always verify — mTLS everywhere.' },
  { id: 'sec_sbom', name: 'SBOM + Supply Chain', category: 'security', tier: 3, invented: false, skill: 'supply_chain', description: 'Software bill of materials & signed artifacts.' },

  // ---- FUTURISTIC (invented) ----
  { id: 'fut_quantum_ci', name: 'Quantum-Superposed CI', category: 'futuristic', tier: 4, invented: true, skill: 'quantum_build', description: 'Pipelines that evaluate all branches simultaneously; build time collapses to zero.' },
  { id: 'fut_neural_mesh', name: 'Neural Mesh Deploy', category: 'futuristic', tier: 4, invented: true, skill: 'autonomous_deploy', description: 'Self-healing deploy fabric that reroutes around failed nodes via swarm intelligence.' },
  { id: 'fut_synth_code', name: 'Synthetic Code Forge', category: 'futuristic', tier: 5, invented: true, skill: 'generative_eng', description: 'Generative compiler that writes, audits and ships patches from intent specs.' },
  { id: 'fut_dark_fabric', name: 'Dark-Fiber Fabric', category: 'futuristic', tier: 5, invented: true, skill: 'stealth_net', description: 'Untraceable inter-DC backbone; defeats deep-packet inspection.' },
  { id: 'fut_bio_vault', name: 'Bio-Vault Compute', category: 'futuristic', tier: 5, invented: true, skill: 'bio_secure', description: 'DNA-lattice cold storage for secrets; tamper-evident at molecular level.' },
];

export const TECH_BY_ID: Record<string, Technology> = Object.fromEntries(TECHNOLOGIES.map(t => [t.id, t]));

/** DEV vertical skills that can be trained on a department's techStack. */
export const DEV_SKILLS: Record<string, string> = {
  pipeline_automation: 'Pipeline Automation',
  gitops: 'GitOps',
  pipeline_as_code: 'Pipeline-as-Code',
  orchestration: 'Orchestration',
  iac: 'Infra-as-Code',
  event_driven: 'Event-Driven',
  model_ops: 'Model Ops',
  security_arch: 'Security Architecture',
  supply_chain: 'Supply-Chain',
  quantum_build: 'Quantum Build',
  autonomous_deploy: 'Autonomous Deploy',
  generative_eng: 'Generative Eng',
  stealth_net: 'Stealth Net',
  bio_secure: 'Bio-Secure',
};
