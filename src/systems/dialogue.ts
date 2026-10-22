import { STATE } from '../core/state';
import type { DialogueNode, DialogueOption, DialogueCondition } from '../types/narrative';
import dialoguesData from '../data/dialogues.json';
import { 
    playSonarChime, 
    playSynapseEvolveSound, 
    playFleetAlarmSound, 
    playCrashSound, 
    playEmpChargeSound 
} from '../engine/audio';
import { renderDirectives } from '../ui/directives';
import { QuestManager } from './quests';

// Registry of loaded dialogue nodes
const dialogueRegistry: Record<string, DialogueNode> = { ...(dialoguesData as Record<string, DialogueNode>) };

// Action handlers registry
type ActionHandler = (option?: DialogueOption) => void;
const actionHandlers: Record<string, ActionHandler> = {};

// Node open listeners registry
type NodeOpenListener = (nodeId: string) => void;
const nodeOpenListeners: NodeOpenListener[] = [];

let isDialogOpen = false;
let currentNodeId: string = 'jamal_orbit_intro';

export class DialogueEngine {
    /**
     * Registers a listener triggered whenever a dialogue node is opened.
     */
    static onNodeOpened(listener: NodeOpenListener): void {
        nodeOpenListeners.push(listener);
    }
    /**
     * Registers additional dialogue nodes dynamically.
     */
    static registerNodes(nodes: Record<string, DialogueNode>): void {
        Object.assign(dialogueRegistry, nodes);
    }

    /**
     * Registers a custom action handler for dialogue option actions.
     */
    static registerAction(actionName: string, handler: ActionHandler): void {
        actionHandlers[actionName] = handler;
    }

    static getNode(nodeId: string): DialogueNode | undefined {
        return dialogueRegistry[nodeId];
    }

    static isDialogOpen(): boolean {
        return isDialogOpen;
    }

    static getCurrentNodeId(): string {
        return currentNodeId;
    }

    /**
     * Checks if a choice option condition is currently met.
     */
    static evaluateCondition(cond?: DialogueCondition): boolean {
        if (!cond) return true;
        if (cond.minSpice !== undefined && (STATE.spiceRes || 0) < cond.minSpice) return false;
        if (cond.minSilicon !== undefined && (STATE.siliconRes || 0) < cond.minSilicon) return false;
        if (cond.minMental !== undefined && (STATE.mentalEnergy || 0) < cond.minMental) return false;
        if (cond.requiresQuestStage) {
            const progress = QuestManager.getQuestProgress(cond.requiresQuestStage.questId);
            if (!progress || progress.currentStage < cond.requiresQuestStage.stage) return false;
        }
        return true;
    }

    /**
     * Opens dialogue card and renders specified node.
     */
    static openDialogue(nodeId: string): DialogueNode | null {
        const node = dialogueRegistry[nodeId];
        if (!node) {
            console.warn(`[DialogueEngine] Dialogue node '${nodeId}' not found.`);
            return null;
        }

        currentNodeId = nodeId;
        isDialogOpen = true;

        nodeOpenListeners.forEach(fn => {
            try { fn(nodeId); } catch (e) { console.error(e); }
        });

        // Play contextual sound
        try {
            if (node.sound === 'synapse') playSynapseEvolveSound();
            else if (node.sound === 'sonar') playSonarChime();
            else if (node.sound === 'alarm') playFleetAlarmSound();
            else if (node.sound === 'crash') playCrashSound();
        } catch (e) {}

        this.renderCard(node);
        return node;
    }

    /**
     * Closes the dialogue card and refreshes HUD.
     */
    static closeDialogue(): void {
        const card = document.getElementById('npc-dialog-card');
        if (card) {
            card.classList.add('hidden');
        }
        isDialogOpen = false;
        renderDirectives();
    }

    /**
     * Handles choice click or hotkey selection.
     */
    static handleChoice(optionOrTarget: DialogueOption | string): void {
        if (typeof optionOrTarget === 'string') {
            if (optionOrTarget === 'close') {
                this.closeDialogue();
                return;
            }
            if (actionHandlers[optionOrTarget]) {
                actionHandlers[optionOrTarget]();
                return;
            }
            if (dialogueRegistry[optionOrTarget]) {
                this.openDialogue(optionOrTarget);
                return;
            }
            this.closeDialogue();
            return;
        }

        const option = optionOrTarget;
        if (option.action) {
            if (option.action === 'close') {
                this.closeDialogue();
                return;
            }
            if (actionHandlers[option.action]) {
                actionHandlers[option.action](option);
                return;
            }
        }

        if (option.targetNodeId && dialogueRegistry[option.targetNodeId]) {
            this.openDialogue(option.targetNodeId);
            return;
        }

        this.closeDialogue();
    }

    /**
     * Renders node content into DOM (#npc-dialog-card).
     */
    private static renderCard(node: DialogueNode): void {
        const card = document.getElementById('npc-dialog-card');
        if (!card) return;

        card.classList.remove('hidden');

        const eyebrowEl = document.getElementById('npc-dialog-title');
        const speakerEl = document.getElementById('npc-dialog-speaker');
        const mainTextEl = document.getElementById('npc-dialog-main-text');
        const subTextEl = document.getElementById('npc-dialog-sub-text');
        const choicesContainer = document.getElementById('npc-dialog-choices');

        if (eyebrowEl) eyebrowEl.innerText = node.eyebrow || 'KOMMUNIKATION';
        if (speakerEl) speakerEl.innerText = `${node.speakerName || 'Dr. Tariq Jamal'} [${node.speakerTitle || 'Telepathie'}]`;
        if (mainTextEl) mainTextEl.innerText = node.mainText;
        if (subTextEl) subTextEl.innerText = node.subText;

        if (choicesContainer) {
            choicesContainer.innerHTML = '';
            node.options.forEach((opt, idx) => {
                if (!this.evaluateCondition(opt.condition)) return;

                const btn = document.createElement('button');
                btn.className = 'prologue-choice-btn';
                btn.innerHTML = `
                    <span class="prologue-choice-key">${opt.keyHint || (idx + 1)}</span>
                    <span class="prologue-choice-label">${opt.label}</span>
                `;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleChoice(opt);
                });
                choicesContainer.appendChild(btn);
            });
        }
    }
}
