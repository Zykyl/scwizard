// Firebase 공유 리더보드 초기화 (GitHub Actions "리더보드 초기화" 워크플로에서 실행)
// - leaderboard 컬렉션의 모든 기록 삭제
// - meta/leaderboard.resetAt 기록 → 각 플레이어 브라우저의 예전 로컬 기록도 자동 정리
// 필요: 환경변수 FIREBASE_SERVICE_ACCOUNT (Firebase 서비스 계정 키 JSON 전체)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const COLLECTION = 'leaderboard';
const META_DOC = 'meta/leaderboard';

function loadCredential() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
        // 로컬 에뮬레이터 테스트용
        if (process.env.FIRESTORE_EMULATOR_HOST) return { projectId: process.env.GCLOUD_PROJECT || 'demo-test' };
        throw new Error('FIREBASE_SERVICE_ACCOUNT 값이 없습니다.');
    }
    let account;
    try {
        account = JSON.parse(raw);
    } catch (e) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT 가 올바른 JSON 이 아닙니다. 키 파일 내용 전체를 붙여 넣었는지 확인해주세요.');
    }
    return { credential: cert(account), projectId: account.project_id };
}

const options = loadCredential();
initializeApp(options);
const db = getFirestore();

// 1) 초기화 시각 먼저 기록 (삭제 도중 실패해도 화면에서는 예전 기록이 숨겨짐)
await db.doc(META_DOC).set({
    resetAt: FieldValue.serverTimestamp(),
    resetBy: process.env.GITHUB_ACTOR ? `github:${process.env.GITHUB_ACTOR}` : 'script'
}, { merge: true });

// 2) 기록 삭제 (한 번에 400개씩)
let deleted = 0;
while (true) {
    const snap = await db.collection(COLLECTION).limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
}

console.log(`프로젝트 ${options.projectId}: 공유 기록 ${deleted}개 삭제, 초기화 시각 기록 완료`);
