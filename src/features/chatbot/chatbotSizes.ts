// 고령자 세션(is_older)에서 화면을 키우기 위한 크기 표.
// 디자인 원본 Chat.dc.html 의 sz 맵을 옮긴 것이라, 값을 고칠 때 두 벌을 함께 본다.
// 본인인증 화면은 아직 is_older 를 모르는 시점이라 기본 크기 하나로만 그린다.

export type ChatSizes = {
    /** 헤더 아바타 */
    avatar: string;
    /** 말풍선 옆 아바타 */
    avatarSmall: string;
    headerFont: string;
    subFont: string;
    msgFont: string;
    msgPadding: string;
    actionFont: string;
    actionPadding: string;
    /** 버튼 묶음을 말풍선 본문과 맞추는 들여쓰기(아바타 + 간격 8px) */
    actionIndent: string;
    dayFont: string;
    /** 말풍선 사이 세로 간격 */
    rowGap: string;
    noteFont: string;
    inputFont: string;
    inputPadding: string;
    sendSize: string;
    sendIcon: number;
};

const DEFAULT_SIZES: ChatSizes = {
    avatar: "40px",
    avatarSmall: "28px",
    headerFont: "15px",
    subFont: "11.5px",
    msgFont: "14px",
    msgPadding: "11px 14px",
    actionFont: "13.5px",
    actionPadding: "11px 16px",
    actionIndent: "36px",
    dayFont: "11px",
    rowGap: "14px",
    noteFont: "12.5px",
    inputFont: "14px",
    inputPadding: "12px 16px",
    sendSize: "40px",
    sendIcon: 18,
};

const SENIOR_SIZES: ChatSizes = {
    avatar: "46px",
    avatarSmall: "34px",
    headerFont: "18px",
    subFont: "14px",
    msgFont: "17px",
    msgPadding: "15px 18px",
    actionFont: "16px",
    actionPadding: "16px 18px",
    actionIndent: "42px",
    dayFont: "13px",
    rowGap: "16px",
    noteFont: "15px",
    inputFont: "17px",
    inputPadding: "16px 18px",
    sendSize: "48px",
    sendIcon: 22,
};

export function chatSizes(isOlder: boolean): ChatSizes {
    return isOlder ? SENIOR_SIZES : DEFAULT_SIZES;
}
