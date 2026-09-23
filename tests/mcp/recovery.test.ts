import { describe, it, expect } from 'vitest';
import { recoveryAction, recoveryCopy } from '../../src/shared/agentRecovery.js';
import { agentLocales, skillMarkdown } from '../../src/shared/agentCopy.js';
import { installationGuide } from '../../src/shared/agentBootstrap.js';
import { claudeCommands, claudeInstall } from '../../src/shared/claudeInstall.js';

describe('authorization recovery', () => {
  it('does not retry unusable authorization links or consumed login states', () => {
    for (const code of ['authorization_expired','invalid_client_or_redirect','invalid_request']) expect(recoveryAction(code)).toBe('restart');
    for (const code of ['invalid_login_state','invalid_identity','sign_in_required','invalid_csrf']) expect(recoveryAction(code)).toBe('signIn');
    expect(recoveryAction('beta_access_required')).toBe('none');
    expect(recoveryAction('temporarily_unavailable')).toBe('retry');
    expect(recoveryAction('Failed to fetch')).toBe('retry');
  });
  it('provides every locale with recovery guidance and native OAuth installation rules', () => {
    for (const locale of agentLocales) {
      for (const text of Object.values(recoveryCopy[locale])) expect(text.trim()).not.toBe('');
      expect(installationGuide(locale)).toContain('Never invent, manually assemble, edit or reuse an authorization URL');
      expect(skillMarkdown(locale)).toContain('do not keep refreshing the failed page');
    }
  });
  it('includes Claude Code installation and Claude web connector guidance in all five locales', () => {
    expect(claudeCommands.add).toContain('https://active-etf-mcp.inthewins.com/api/mcp');
    expect(claudeCommands.skillPath).toBe('~/.claude/skills/active-etf-research/SKILL.md');
    for (const locale of agentLocales) {
      const copy = claudeInstall[locale];
      for (const key of ['codeSave','codeSetup','codeOauth','webSetup','webOrg','webSkill','guide'] as const) {
        expect(copy[key].trim()).not.toBe('');
      }
      expect(copy.webSetup).toContain('Customize → Connectors');
      expect(installationGuide(locale)).toContain(claudeCommands.skillPath);
      expect(installationGuide(locale)).toContain(claudeCommands.add);
    }
  });
});
