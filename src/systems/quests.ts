import { STATE } from '../core/state';
import type { 
    QuestDefinition, 
    QuestProgress, 
    QuestStage, 
    QuestObjectiveType 
} from '../types/narrative';
import questsData from '../data/quests.json';
import { addLogEntry } from '../ui/hud';

// In-memory registry of loaded quest definitions
const questRegistry: Record<string, QuestDefinition> = { ...(questsData as Record<string, QuestDefinition>) };

// Ensure STATE has activeQuests dictionary initialized
function ensureStateQuests(): Record<string, QuestProgress> {
    if (!STATE.activeQuests) {
        STATE.activeQuests = {};
    }
    return STATE.activeQuests;
}

export class QuestManager {
    /**
     * Registers or overrides a quest definition at runtime.
     */
    static registerQuest(quest: QuestDefinition): void {
        questRegistry[quest.id] = quest;
    }

    /**
     * Retrieves the definition of a registered quest.
     */
    static getQuest(questId: string): QuestDefinition | undefined {
        return questRegistry[questId];
    }

    /**
     * Starts a quest, setting its stage to 0.
     */
    static startQuest(questId: string): QuestProgress | null {
        const quest = questRegistry[questId];
        if (!quest) {
            console.warn(`[QuestManager] Cannot start quest '${questId}': definition not found.`);
            return null;
        }

        const quests = ensureStateQuests();
        if (quests[questId] && !quests[questId].completed) {
            return quests[questId];
        }

        const progress: QuestProgress = {
            questId,
            currentStage: 0,
            completed: false
        };
        quests[questId] = progress;

        // Sync legacy state flags if applicable
        if (questId === 'prologue_jamal_ship') {
            STATE.jamalMissionActive = true;
            STATE.jamalMissionCompleted = false;
        }

        addLogEntry("SYSTEM", `📋 Neue Mission aktiv: [${quest.title}]`);
        return progress;
    }

    /**
     * Advances the quest to the next stage or a specific target stage.
     */
    static advanceQuest(questId: string, targetStage?: number): QuestProgress | null {
        const quest = questRegistry[questId];
        const quests = ensureStateQuests();
        const progress = quests[questId];

        if (!quest || !progress) {
            return null;
        }

        const nextStageIndex = targetStage !== undefined ? targetStage : progress.currentStage + 1;
        const totalStages = quest.stages.length;

        if (nextStageIndex >= totalStages - 1) {
            // Last stage is completion
            progress.currentStage = totalStages - 1;
            this.completeQuest(questId);
        } else {
            progress.currentStage = nextStageIndex;
            const currentStageObj = quest.stages[progress.currentStage];
            if (currentStageObj) {
                addLogEntry("SYSTEM", `📋 Missionsziel aktualisiert: [${quest.title}] -> ${currentStageObj.title}`);
            }
        }

        // Sync legacy state flags
        if (questId === 'prologue_jamal_ship') {
            if (progress.currentStage >= 1) {
                STATE.jamalMissionDiscovered = true;
            }
        }

        return progress;
    }

    /**
     * Completes the quest and awards rewards.
     */
    static completeQuest(questId: string): QuestProgress | null {
        const quest = questRegistry[questId];
        const quests = ensureStateQuests();
        const progress = quests[questId];

        if (!quest || !progress) return null;

        progress.completed = true;
        progress.currentStage = quest.stages.length - 1;

        if (quest.rewards) {
            if (quest.rewards.spice) STATE.spiceRes = (STATE.spiceRes || 0) + quest.rewards.spice;
            if (quest.rewards.silicon) STATE.siliconRes = (STATE.siliconRes || 0) + quest.rewards.silicon;
            if (quest.rewards.bio) STATE.bioRes = (STATE.bioRes || 0) + quest.rewards.bio;
            if (quest.rewards.mental) STATE.mentalEnergy = Math.min(STATE.maxMentalEnergy, STATE.mentalEnergy + quest.rewards.mental);
        }

        // Sync legacy state flags
        if (questId === 'prologue_jamal_ship') {
            STATE.jamalMissionCompleted = true;
            STATE.jamalShipLiberated = true;
        }

        addLogEntry("SYSTEM", `🎉 Mission abgeschlossen: [${quest.title}] ✔`);
        return progress;
    }

    static isQuestActive(questId: string): boolean {
        // Check both manager state and legacy boolean flags
        if (questId === 'prologue_jamal_ship' && STATE.jamalMissionActive && !STATE.jamalMissionCompleted) {
            return true;
        }
        const quests = ensureStateQuests();
        return !!(quests[questId] && !quests[questId].completed);
    }

    static isQuestCompleted(questId: string): boolean {
        if (questId === 'prologue_jamal_ship' && STATE.jamalMissionCompleted) {
            return true;
        }
        const quests = ensureStateQuests();
        return !!(quests[questId] && quests[questId].completed);
    }

    static getQuestProgress(questId: string): QuestProgress | undefined {
        const quests = ensureStateQuests();
        if (!quests[questId] && questId === 'prologue_jamal_ship' && STATE.jamalMissionActive) {
            quests[questId] = {
                questId: 'prologue_jamal_ship',
                currentStage: STATE.jamalMissionCompleted ? 2 : (STATE.jamalMissionDiscovered ? 1 : 0),
                completed: !!STATE.jamalMissionCompleted
            };
        }
        return quests[questId];
    }

    static getCurrentStage(questId: string): QuestStage | null {
        const quest = questRegistry[questId];
        const progress = this.getQuestProgress(questId);
        if (!quest || !progress) return null;
        return quest.stages[progress.currentStage] || null;
    }

    /**
     * Returns all currently active or tracked quests for UI rendering.
     */
    static getActiveQuests(): Array<{ definition: QuestDefinition; progress: QuestProgress; currentStage: QuestStage }> {
        const quests = ensureStateQuests();

        // Ensure legacy mission is synchronized
        if (STATE.jamalMissionActive && !quests['prologue_jamal_ship']) {
            quests['prologue_jamal_ship'] = {
                questId: 'prologue_jamal_ship',
                currentStage: STATE.jamalMissionCompleted ? 2 : (STATE.jamalMissionDiscovered ? 1 : 0),
                completed: !!STATE.jamalMissionCompleted
            };
        }

        const activeList: Array<{ definition: QuestDefinition; progress: QuestProgress; currentStage: QuestStage }> = [];

        for (const [id, progress] of Object.entries(quests)) {
            const def = questRegistry[id];
            if (def) {
                // Keep stage in sync with legacy discovery flag if needed
                if (id === 'prologue_jamal_ship') {
                    if (STATE.jamalMissionCompleted) {
                        progress.completed = true;
                        progress.currentStage = 2;
                    } else if (STATE.jamalMissionDiscovered && progress.currentStage === 0) {
                        progress.currentStage = 1;
                    }
                }
                const stage = def.stages[progress.currentStage] || def.stages[def.stages.length - 1];
                activeList.push({
                    definition: def,
                    progress,
                    currentStage: stage
                });
            }
        }

        return activeList;
    }

    /**
     * Ingests gameplay events (target scanned, proximity, choice made) to advance objectives.
     */
    static notifyQuestEvent(eventType: QuestObjectiveType, payload?: any): void {
        const active = this.getActiveQuests();

        for (const item of active) {
            if (item.progress.completed) continue;
            const obj = item.currentStage.objective;
            if (!obj) continue;

            if (obj.type === eventType) {
                if (eventType === 'scan_target' && obj.targetId && payload === obj.targetId) {
                    this.advanceQuest(item.definition.id);
                } else if (eventType === 'dialogue_completed' && obj.nodeId && payload === obj.nodeId) {
                    this.advanceQuest(item.definition.id);
                } else if (eventType === 'completed') {
                    this.completeQuest(item.definition.id);
                }
            }
        }
    }
}
