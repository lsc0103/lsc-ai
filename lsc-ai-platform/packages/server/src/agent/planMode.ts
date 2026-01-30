/**
 * Plan Mode Manager (Stub)
 * TODO: Implement full plan mode functionality
 */

export interface PlanStep {
  index: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  files?: string[];
}

export interface PlanContent {
  title: string;
  description: string;
  steps: PlanStep[];
  analysis?: string;
  affectedFiles?: string[];
  risks?: string[];
}

export interface PlanSession {
  id: string;
  content: PlanContent | null;
  status: 'planning' | 'submitted' | 'approved' | 'rejected' | 'pending_approval';
  filePath?: string;
  currentStep?: number;
}

class PlanManager {
  private currentPlan: PlanContent | null = null;
  private currentSession: PlanSession | null = null;
  private inPlanMode = false;

  isInPlanMode(): boolean {
    return this.inPlanMode;
  }

  getCurrentSession(): PlanSession | null {
    return this.currentSession;
  }

  async enterPlanMode(taskDescription: string): Promise<PlanSession> {
    this.inPlanMode = true;
    this.currentSession = {
      id: `plan-${Date.now()}`,
      content: {
        title: taskDescription,
        description: '',
        steps: [],
      },
      status: 'planning',
    };
    this.currentPlan = this.currentSession.content;
    return this.currentSession;
  }

  exitPlanMode(): void {
    this.inPlanMode = false;
    this.currentSession = null;
    this.currentPlan = null;
  }

  async updatePlan(content: Partial<PlanContent>): Promise<void> {
    if (this.currentPlan) {
      Object.assign(this.currentPlan, content);
    }
  }

  async submitForApproval(): Promise<PlanContent> {
    if (this.currentSession) {
      this.currentSession.status = 'submitted';
    }
    return this.currentPlan || { title: '', description: '', steps: [] };
  }

  async readPlanFile(): Promise<string> {
    // TODO: Implement reading plan from file
    return JSON.stringify(this.currentPlan, null, 2);
  }

  getCurrentPlan(): PlanContent | null {
    return this.currentPlan;
  }

  setPlan(plan: PlanContent): void {
    this.currentPlan = plan;
  }

  clearPlan(): void {
    this.currentPlan = null;
  }

  approvePlan(): PlanContent | null {
    if (this.currentSession) {
      this.currentSession.status = 'approved';
    }
    return this.currentPlan;
  }

  rejectPlan(_feedback?: string): void {
    if (this.currentSession) {
      this.currentSession.status = 'rejected';
    }
    this.currentPlan = null;
  }
}

export const planManager = new PlanManager();
