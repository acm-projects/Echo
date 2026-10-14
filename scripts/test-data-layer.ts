
import assert from 'node:assert/strict';

import { dataConfig, type MockScenario } from '../src/data/config';
import {
  getMyProfile,
  getMyBooks,
  getBook,
  getBookChapters,
  getBookCharacters,
  getBookProgress,
  getMyProgress,
  getMyStreak,
  getMyFriendships,
  getCommunityBooks,
  getRoomPosts,
  getCommunityReviews,
} from '../src/data';

import { BOOK_IDS } from '../src/mock/books';
import { USER_IDS } from '../src/mock/users';
import { COMMUNITY_BOOK_IDS } from '../src/mock/community';

async function testNormalScenario() {
  console.log('Testing normal scenario...');

  dataConfig.scenario = 'normal';

  const profile = await getMyProfile();

  if (!profile) {
    throw new Error('Expected current user profile');
  }

  assert.equal(profile.id, USER_IDS.current);

  const books = await getMyBooks();
  assert.equal(books.length, 4);
  assert.ok(
    books.every((book) => book.user_id === USER_IDS.current)
  );

  const gatsby = await getBook(BOOK_IDS.gatsby);

  if (!gatsby) {
    throw new Error('Expected Gatsby book');
  }

  assert.equal(gatsby.title, 'The Great Gatsby');

  const chapters = await getBookChapters(BOOK_IDS.gatsby);
  assert.equal(chapters.length, 9);
  assert.equal(chapters[0].chapter_index, 0);
  assert.equal(chapters[8].chapter_index, 8);

  const gameOfThronesChapters = await getBookChapters(
    BOOK_IDS.gameOfThrones
  );

  assert.equal(gameOfThronesChapters.length, 73);

  const characters = await getBookCharacters(BOOK_IDS.gatsby);
  assert.equal(characters.length, 4);

  const progress = await getBookProgress(BOOK_IDS.gatsby);

  if (!progress) {
    throw new Error('Expected Gatsby listening progress');
  }

  assert.equal(progress.user_id, USER_IDS.current);
  assert.equal(progress.chapter_id, chapters[3].id);

  const allProgress = await getMyProgress();
  assert.equal(allProgress.length, 2);

  const streak = await getMyStreak();

  if (!streak) {
    throw new Error('Expected current user streak');
  }

  assert.equal(streak.current_streak, 7);

  const friendships = await getMyFriendships();
  assert.equal(friendships.length, 3);

  const communityBooks = await getCommunityBooks();
  assert.equal(communityBooks.length, 2);

  const roomPosts = await getRoomPosts();
  assert.equal(roomPosts.length, 2);

  const reviews = await getCommunityReviews(
    COMMUNITY_BOOK_IDS.gatsby
  );

  assert.equal(reviews.length, 3);

  console.log('Normal scenario passed.');
}

async function testEmptyScenario() {
  console.log('Testing empty scenario...');

  dataConfig.scenario = 'empty';

  assert.deepEqual(await getMyBooks(), []);
  assert.equal(await getMyProfile(), null);
  assert.equal(await getBook(BOOK_IDS.gatsby), null);
  assert.deepEqual(await getBookChapters(BOOK_IDS.gatsby), []);
  assert.deepEqual(await getMyProgress(), []);
  assert.equal(await getMyStreak(), null);
  assert.deepEqual(await getCommunityBooks(), []);

  console.log('Empty scenario passed.');
}

async function testErrorScenario() {
  console.log('Testing error scenario...');

  dataConfig.scenario = 'error';

  await assert.rejects(
    getMyBooks(),
    /Mock data request failed/
  );

  await assert.rejects(
    getMyProfile(),
    /Mock data request failed/
  );

  await assert.rejects(
    getCommunityBooks(),
    /Mock data request failed/
  );

  console.log('Error scenario passed.');
}

async function testSlowScenario() {
  console.log('Testing slow scenario...');

  dataConfig.scenario = 'slow';
  dataConfig.slowDelayMs = 100;

  const start = Date.now();
  const books = await getMyBooks();
  const elapsed = Date.now() - start;

  assert.equal(books.length, 4);
  assert.ok(elapsed >= 90);

  console.log('Slow scenario passed.');
}

async function main() {
  const originalScenario: MockScenario = dataConfig.scenario;
  const originalDelay = dataConfig.slowDelayMs;

  try {
    await testNormalScenario();
    await testEmptyScenario();
    await testErrorScenario();
    await testSlowScenario();

    console.log('\nAll data layer tests passed!');
  } finally {
    dataConfig.scenario = originalScenario;
    dataConfig.slowDelayMs = originalDelay;
  }
}

main().catch((error) => {
  console.error('Data layer tests failed:', error);
  process.exitCode = 1;
});
