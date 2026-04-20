import test from 'node:test';
import assert from 'node:assert/strict';
import { issueSessionToken, verifySessionToken, isGuid } from './auth.js';

process.env.APP_TOKEN_SECRET = 'unit-test-secret';

test('issueSessionToken creates a verifiable token', () => {
  const token = issueSessionToken({ id: '123e4567-e89b-12d3-a456-426614174000', nome: 'Mario' });
  const user = verifySessionToken(token);

  assert.ok(user);
  assert.equal(user?.id, '123e4567-e89b-12d3-a456-426614174000');
  assert.equal(user?.nome, 'Mario');
});

test('verifySessionToken rejects tampered tokens', () => {
  const token = issueSessionToken({ id: '123e4567-e89b-12d3-a456-426614174000', nome: 'Mario' });
  const tampered = `${token}x`;

  assert.equal(verifySessionToken(tampered), null);
});

test('isGuid validates guid format', () => {
  assert.equal(isGuid('123e4567-e89b-12d3-a456-426614174000'), true);
  assert.equal(isGuid('bad-guid'), false);
});
