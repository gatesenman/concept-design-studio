export type ID = string;
export interface Vision { problem: string; target: string; vision: string; goals: string; nonGoals: string; metrics: string; constraints: string; }
export interface Stakeholder { id: ID; name: string; role: string; influence: string; interest: string; expectations: string; strategy: string; }
export interface Persona { id: ID; name: string; role: string; age: string; goals: string; pains: string; behaviors: string; quote: string; color: string; }
export interface JourneyStage { id: ID; name: string; action: string; touchpoint: string; emotion: number; pain: string; opportunity: string; }
export interface Journey { id: ID; title: string; personaId: ID; scenario: string; stages: JourneyStage[]; }
export interface Requirement { id: ID; code: string; type: '用户故事' | '功能需求' | '非功能需求' | '约束'; title: string; asA: string; iWant: string; soThat: string; acceptance: string; moscow: 'Must' | 'Should' | 'Could' | "Won't"; kano: '基本型' | '期望型' | '兴奋型' | '无差异' | '反向型'; status: '草稿' | '评审中' | '已确认' | '已拒绝'; featureId: ID; stakeholderIds: ID[]; personaId: ID; effort: number; value: number; }
export interface Feature { id: ID; name: string; epic: string; release: 'MVP' | 'V1.x' | '未来' | '不做'; desc: string; }
export interface Criterion { id: ID; name: string; weight: number; }
export interface ConceptOption { id: ID; name: string; desc: string; pros: string; cons: string; scores: Record<ID, number>; }
export interface Risk { id: ID; kind: '风险' | '假设' | '问题' | '依赖'; desc: string; probability: number; impact: number; mitigation: string; owner: string; status: '开放' | '处理中' | '已关闭' | '已验证'; }
export interface Decision { id: ID; title: string; context: string; decision: string; consequences: string; status: '提议' | '已采纳' | '已废弃'; date: string; }
export interface Term { id: ID; term: string; en: string; definition: string; }
export interface Project {
  id: ID; name: string; description: string; template: string; owner: string; phase: string; createdAt: string; updatedAt: string;
  vision: Vision; stakeholders: Stakeholder[]; personas: Persona[]; journeys: Journey[]; requirements: Requirement[]; features: Feature[];
  criteria: Criterion[]; options: ConceptOption[]; architecture: string; contextDiagram: string; risks: Risk[]; decisions: Decision[]; glossary: Term[];
  ai?: import('./ai').AIState;
}
export interface AppData { version: number; currentId: ID | null; projects: Project[]; prefs?: any; }
