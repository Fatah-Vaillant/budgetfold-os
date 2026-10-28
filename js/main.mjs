// BudgetFold OS · module main (voir CLAUDE.md, « Architecture »).
import { VERSION, clock } from './util.mjs';
import { budgetKey, currentMonth, cycleEnd, cycleStart, emptyState, envLook, fromAnyVersion, replaceState, save, securePersistence, state } from './data.mjs';
import { accountBalance, addAccount, addFavorite, addRule, addSplit, addSubscription, addTransaction, addWish, buildIcs, cashflow, closeMonth, closingDefaults, computeInsights, createEnvelope, deleteAccount, deleteCatRule, deleteEnvelope, deleteFavorite, deleteMove, deleteRule, deleteTransaction, derive, detectSubscriptions, envRow, envelopeSuggestions, favoriteSuggestions, forecast, frequentAmounts, guessEnvelope, healthScore, monthlyOf, monthlyReport, moveMoney, nextPayMonth, noSpendStreak, occurrences, pendingClosings, periodWindow, postRecurring, proRevenue, projectAdvice, projectContribution, projectPlan, projectResults, reconcileAccount, reopenMonth, resetAllEnvelopes, resetEnvelope, runRollover, runScenarios, saveCatRule, searchTransactions, setProSettings, setSalary, setSettings, simulate, spendingHours, splitNeeds, subscriptionsCost, upcomingEvents, updateEnvelope, updateProjectInfo, updateRule, updateTransaction, useFavorite } from './engine.mjs';
import { Photos, cleanupPhotos, compressPhoto, fullBackupZip, makeZip, parseReceipt, parseStatement, pdfText, proofsZip, readZip, receiptDetail, savePhoto } from './io.mjs';
import { announceClosed, announceCredits, announcePosted, applyHash, applyTheme, checkPin, cropCanvas, disableLock, enableBiometric, encryptedBackup, exportData, importJson, isLocked, lockApp, openAccounts, openAdd, openClosing, openEnv, openHelp, openMove, openPrivacy, openProject, openProofs, openRule, openRules, openSecurity, openSubs, openTx, openWelcome, readTransfer, remindDue, render, setPin, setTab, showUpdate, startCsvImport, startTour, tick, transferLink, ui, unlockBiometric, wipeEverything } from './ui.mjs';

window.BudgetFold = {
  version: VERSION,
  clock,
  ui,
  getState: () => state,
  setState: (raw) => { replaceState(fromAnyVersion(raw) || emptyState()); render(); },
  tick: () => { const r = tick(); render(); return r; },
  derive, cashflow, forecast, upcomingEvents, computeInsights, parseStatement, parseReceipt, receiptDetail, runRollover,
  postRecurring, occurrences, periodWindow, envRow, projectPlan, render, setTab, guessEnvelope,
  cycleStart, cycleEnd, budgetKey, currentMonth, pendingClosings, closingDefaults, nextPayMonth,
  projectResults, simulate, runScenarios, projectAdvice, monthlyOf, projectContribution,
  Photos, savePhoto, compressPhoto, readZip, makeZip, fullBackupZip, proofsZip, pdfText, cropCanvas, proRevenue,
  accountBalance, frequentAmounts, favoriteSuggestions, searchTransactions, detectSubscriptions, buildIcs,
  healthScore, monthlyReport, envelopeSuggestions, subscriptionsCost, noSpendStreak, splitNeeds, spendingHours, envLook, applyTheme,
  actions: {
    addTransaction, updateTransaction, deleteTransaction, createEnvelope, updateEnvelope, deleteEnvelope, resetEnvelope,
    addRule, updateRule, deleteRule, setSalary, setSettings, openAdd, openTx, openRule, openEnv,
    closeMonth, reopenMonth, moveMoney, deleteMove, resetAllEnvelopes, openClosing, openMove, exportData,
    addWish, updateProjectInfo, openProject, saveCatRule, deleteCatRule, setProSettings, addSplit, openRules, openProofs, importJson,
    openWelcome, startTour, openHelp, encryptedBackup, transferLink, readTransfer, setPin, checkPin, disableLock, enableBiometric,
    unlockBiometric, lockApp, isLocked, wipeEverything, showUpdate, openSecurity, openPrivacy, addAccount, deleteAccount, reconcileAccount, addFavorite, deleteFavorite, useFavorite, addSubscription, openAccounts, openSubs, startCsvImport
  }
};

const boot = tick();
save();
applyTheme();
if (state.prefs.lock.enabled) lockApp();
render();
securePersistence();
cleanupPhotos();
announceClosed(boot.closed);
announceCredits(boot.credits);
announcePosted(boot.posted);
applyHash();
if (!state.prefs.onboarded && state.salary <= 0 && state.envelopes.length === 0) openWelcome();
else if (pendingClosings().length && !state.prefs.closing.auto) openClosing();
if (state.prefs.onboarded) remindDue();
