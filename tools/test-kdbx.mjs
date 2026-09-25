/**
 * Opens, edits and saves real .kdbx files through src/kdbx.ts and src/search.ts:
 * the sample Database.kdbx (AES-KDF) and a freshly created Argon2id database.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checker, load, root } from './load.mjs';

const K = await load('kdbx', 'search');
const { check, done } = checker();

const PASSWORD = 'Тестовый пароль';
const bytes = await readFile(join(root, 'tools', 'fixtures', 'Database.kdbx'));
const sample = () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

async function rejects(promise) {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    return K.describeError(error);
  }
}

// Opening the sample database
const db = await K.openDatabase(sample(), PASSWORD, null);
const rootGroup = db.getDefaultGroup();
check('root group name', rootGroup.name, 'Database');
check('format', K.describeFormat(db), 'KDBX 4.0 · AES-256 · AES-KDF');
check('subgroups', rootGroup.groups.map((g) => g.name), ['General', 'Windows', 'Network', 'Internet', 'eMail', 'Homebanking']);
check('root entries', rootGroup.entries.map(K.titleOf), ['Sample Entry', 'Sample Entry #2']);
const first = rootGroup.entries[0];
check('user name', K.field(first, 'UserName'), 'User Name');
check('password is protected', K.isProtected(first, 'Password'), true);
check('password text', K.field(first, 'Password'), 'Password');
check('all entries', K.entriesBelow(db, rootGroup).length, 3);
check('cyrillic title', K.titleOf(rootGroup.groups[0].entries[0]), 'Проверочный аккаунт');
check('group path', K.groupPath(rootGroup.groups[0]), ['General']);
check('no recycle bin yet', K.recycleBin(db), null);

// Wrong credentials
check('wrong password', await rejects(K.openDatabase(sample(), 'nope', null)), 'Wrong password or key file');
check('not a database', await rejects(K.openDatabase(new TextEncoder().encode('hello world, not kdbx').buffer, 'x', null)), 'This is not a KeePass database');

// Search and sort
check('search title', K.entriesBelow(db, rootGroup).filter((e) => K.matches(e, 'sample')).length, 2);
check('search two words', K.entriesBelow(db, rootGroup).filter((e) => K.matches(e, 'sample michael')).map(K.titleOf), ['Sample Entry #2']);
check('search skips passwords', K.entriesBelow(db, rootGroup).filter((e) => K.matches(e, '12345')).length, 0);
check('search cyrillic, any case', K.entriesBelow(db, rootGroup).filter((e) => K.matches(e, 'ПРОВЕРОЧНЫЙ')).length, 1);
check('sort by title', K.sortEntries(K.entriesBelow(db, rootGroup), 'title').map(K.titleOf), ['Sample Entry', 'Sample Entry #2', 'Проверочный аккаунт']);
check('host of url', K.hostOf('https://www.keepass.info/help/'), 'keepass.info');
check('host without scheme', K.hostOf('example.org/login'), 'example.org');
check('safe href', K.safeHref('keepass.info'), 'https://keepass.info/');
check('javascript: is not a link', K.safeHref('javascript:alert(1)'), null);

// Editing, the recycle bin and a round trip
const general = rootGroup.groups[0];
const entry = K.createEntry(db, general);
entry.fields.set('Title', 'Mail');
entry.fields.set('UserName', 'me@example.org');
entry.fields.set('Password', K.makeValue('s3cret-Пароль', true));
entry.fields.set('PIN', K.makeValue('0000', true));
entry.tags = ['work', 'mail'];
await K.addAttachment(db, entry, 'note.txt', new TextEncoder().encode('attached').buffer);
entry.pushHistory();
entry.fields.set('UserName', 'me@example.com');
K.touch(entry);

check('trash first entry', K.remove(db, rootGroup.entries[1]), 'trashed');
const bin = K.recycleBin(db);
check('recycle bin created', bin?.name, 'Recycle Bin');
check('entries skip the bin', K.entriesBelow(db, rootGroup).length, 3);
check('trashed is inside the bin', K.inRecycleBin(db, bin.entries[0]), true);
check('tags', [...K.allTags(db).keys()], ['mail', 'work']);

const sub = K.createGroup(db, general, 'Sub');
check('cannot move a group into itself', K.canMoveGroup(general, sub), false);
check('can move a group elsewhere', K.canMoveGroup(sub, rootGroup), true);

const saved = await K.saveDatabase(db);
const reopened = await K.openDatabase(saved, PASSWORD, null);
const again = reopened.getDefaultGroup().groups[0].entries.find((e) => K.field(e, 'Title') === 'Mail');
check('round trip: user name', K.field(again, 'UserName'), 'me@example.com');
check('round trip: password', K.field(again, 'Password'), 's3cret-Пароль');
check('round trip: custom field protected', K.isProtected(again, 'PIN'), true);
check('round trip: custom fields', K.customFields(again), ['PIN']);
check('round trip: tags', again.tags, ['work', 'mail']);
check('round trip: history', again.history.map((h) => K.field(h, 'UserName')), ['me@example.org']);
check('round trip: attachment', new TextDecoder().decode(K.binaryBytes(again.binaries.get('note.txt'))), 'attached');
check('round trip: recycle bin', K.recycleBin(reopened)?.entries.map(K.titleOf), ['Sample Entry #2']);

// Restoring from the bin and deleting for good
const trashed = K.recycleBin(reopened).entries[0];
K.restore(reopened, trashed);
check('restored to where it was', trashed.parentGroup === reopened.getDefaultGroup(), true);
check('deleted for good from the bin', (K.remove(reopened, trashed), K.remove(reopened, trashed)), 'deleted');
check('gone', K.entriesBelow(reopened, reopened.getDefaultGroup()).some((e) => e === trashed), false);

// A new database with Argon2id and a password change
const t0 = Date.now();
const created = await K.createDatabase('Personal', 'first', null);
check('new: format', K.describeFormat(created), 'KDBX 4.0 · AES-256 · Argon2id');
check('new: groups', created.getDefaultGroup().groups.map((g) => g.name), ['General', 'Email', 'Internet', 'Banking', 'Recycle Bin']);
await K.changeCredentials(created, 'second', null);
const createdBytes = await K.saveDatabase(created);
check('new: old password fails', await rejects(K.openDatabase(createdBytes, 'first', null)), 'Wrong password or key file');
const createdAgain = await K.openDatabase(createdBytes, 'second', null);
check('new: reopens', createdAgain.getDefaultGroup().name, 'Personal');
console.log(`  Argon2id create + save + 2 opens: ${Date.now() - t0} ms`);

// A key file on its own and together with a password
const keyFile = await K.kdbxweb.KdbxCredentials.createRandomKeyFile(2);
const keyed = await K.createDatabase('Keyed', '', keyFile.buffer);
const keyedBytes = await K.saveDatabase(keyed);
check('key file only: opens', (await K.openDatabase(keyedBytes, '', keyFile.buffer)).meta.name, 'Keyed');
check('key file only: missing key', await rejects(K.openDatabase(keyedBytes, '', null)), 'Wrong password or key file');
await K.changeCredentials(keyed, 'pw', keyFile.buffer);
const bothBytes = await K.saveDatabase(keyed);
check('password + key file', (await K.openDatabase(bothBytes, 'pw', keyFile.buffer)).meta.name, 'Keyed');
check('password without key file', await rejects(K.openDatabase(bothBytes, 'pw', null)), 'Wrong password or key file');

done('kdbx');
