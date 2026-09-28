import { STATE } from '../core/state';
import { checkAndUpdateContinueButton } from './save-modal';

export function showMainMenu() {
    const mainMenu = document.getElementById('main-menu');
    if (!mainMenu) return;

    mainMenu.style.display = 'flex';
    mainMenu.classList.remove('menu-hidden');

    const resumeBtn = document.getElementById('resume-game-btn');
    if (resumeBtn) {
        resumeBtn.style.display = STATE.gameStarted ? 'flex' : 'none';
    }

    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.innerText = STATE.gameStarted ? "🔄 Neue Reise beginnen (Reset)" : "🧬 Bewusstsein entfalten";
    }

    checkAndUpdateContinueButton();
}

export function hideMainMenu() {
    const mainMenu = document.getElementById('main-menu');
    if (!mainMenu) return;

    mainMenu.classList.add('menu-hidden');
    mainMenu.style.display = 'none';
}

export function toggleMainMenu() {
    const mainMenu = document.getElementById('main-menu');
    if (!mainMenu) return;

    const isHidden = mainMenu.classList.contains('menu-hidden') || mainMenu.style.display === 'none';
    if (isHidden) {
        showMainMenu();
    } else {
        hideMainMenu();
    }
}

export function isMainMenuOpen(): boolean {
    const mainMenu = document.getElementById('main-menu');
    if (!mainMenu) return false;
    return !mainMenu.classList.contains('menu-hidden') && mainMenu.style.display !== 'none';
}
