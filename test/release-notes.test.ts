import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {extractReleaseNotes} from '../scripts/release-notes.ts';

const changelog = `# Changelog

## [Unreleased]

## [1.1.0] - 2026-11-02

### Added

- Second feature.

## [1.0.0] - 2026-10-30

### Added

- First feature.

[unreleased]: https://example.com/compare/v1.1.0...HEAD
[1.1.0]: https://example.com/compare/v1.0.0...v1.1.0
`;

test('returns the section for a version, up to the next one', () => {
	assert.equal(extractReleaseNotes(changelog, '1.1.0'), '### Added\n\n- Second feature.');
});

test('the last section stops at the link definitions', () => {
	assert.equal(extractReleaseNotes(changelog, '1.0.0'), '### Added\n\n- First feature.');
});

test('the last section runs to the end of a file without link definitions', () => {
	assert.equal(extractReleaseNotes('## [1.0.0] - 2026-10-30\n\n- Only feature.\n', '1.0.0'), '- Only feature.');
});

test('a missing or empty section gives undefined', () => {
	assert.equal(extractReleaseNotes(changelog, '2.0.0'), undefined);
	assert.equal(extractReleaseNotes(changelog, 'Unreleased'), undefined);
});

/** Runs the script from a folder holding the sample changelog, like the release workflow does. */
const runScript = (...versionArgument: string[]) => {
	const folder = mkdtempSync(join(tmpdir(), 'release-notes-'));
	writeFileSync(join(folder, 'CHANGELOG.md'), changelog);
	return spawnSync(process.execPath, [join(import.meta.dirname, '../scripts/release-notes.ts'), ...versionArgument], {cwd: folder, encoding: 'utf8'});
};

test('the script prints the notes for a version', () => {
	const result = runScript('1.0.0');
	assert.equal(result.status, 0);
	assert.equal(result.stdout, '### Added\n\n- First feature.\n');
});

test('the script fails when the changelog has no section for the version', () => {
	const result = runScript('2.0.0');
	assert.equal(result.status, 1);
	assert.match(result.stderr, /no entries for 2\.0\.0/);
});

test('the script fails without a version', () => {
	assert.equal(runScript().status, 1);
});
