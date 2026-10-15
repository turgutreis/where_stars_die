export type QuestObjectiveType = 
    | 'scan_target' 
    | 'reach_proximity' 
    | 'dialogue_choice' 
    | 'dialogue_completed' 
    | 'collect_resource' 
    | 'custom' 
    | 'completed';

export interface QuestObjective {
    type: QuestObjectiveType;
    targetId?: string;
    distance?: number;
    resource?: string;
    amount?: number;
    nodeId?: string;
    customCheck?: string;
}

export interface QuestStage {
    stage: number;
    title: string;
    instruction: string;
    hint: string;
    objective?: QuestObjective;
}

export interface QuestReward {
    spice?: number;
    silicon?: number;
    bio?: number;
    mental?: number;
}

export interface QuestDefinition {
    id: string;
    title: string;
    badge?: string;
    category: 'main' | 'side' | 'prologue';
    stages: QuestStage[];
    rewards?: QuestReward;
}

export interface QuestProgress {
    questId: string;
    currentStage: number;
    completed: boolean;
    stageData?: Record<string, any>;
}

export interface DialogueSpeaker {
    name: string;
    title?: string;
    avatar?: string;
    eyebrow?: string;
    speakerType?: 'character' | 'guide' | 'thoughts' | 'system';
}

export interface DialogueCondition {
    minSpice?: number;
    minSilicon?: number;
    minMental?: number;
    requiresQuestStage?: { questId: string; stage: number };
    customCondition?: string;
}

export interface DialogueOption {
    label: string;
    action?: string;
    actionPayload?: string;
    targetNodeId?: string;
    keyHint?: string;
    condition?: DialogueCondition;
}

export interface DialogueNode {
    id: string;
    speakerName?: string;
    speakerTitle?: string;
    speakerType?: 'character' | 'guide' | 'thoughts' | 'system';
    eyebrow?: string;
    mainText: string;
    subText: string;
    sound?: 'sonar' | 'synapse' | 'alarm' | 'crash';
    options: DialogueOption[];
}
