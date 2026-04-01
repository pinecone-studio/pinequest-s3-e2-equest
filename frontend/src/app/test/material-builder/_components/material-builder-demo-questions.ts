"use client";

export type MaterialBuilderDemoQuestion = {
  answers: string[];
  correctIndex: number;
  difficulty: "easy" | "medium" | "hard";
  points: string;
  questionText: string;
  questionType: "single-choice" | "written";
};

export const materialBuilderDemoQuestions: MaterialBuilderDemoQuestion[] = [
  {
    questionText: "Илэрхийллийн утгыг олоорой. $1-2+3-4+5-6+\\cdots+99-100=?$",
    answers: ["$-1$", "$-50$", "$50$", "$-100$", "$100$"],
    correctIndex: 1,
    points: "1",
    questionType: "single-choice",
    difficulty: "easy",
  },
  {
    questionText:
      "$x^2+5x+6$ олон гишүүнтийг үржигдэхүүн болгон задал.",
    answers: [
      "$(x+5)(x+1)$",
      "$(x+4)(x+2)$",
      "$(x+2)(x+6)$",
      "$(x+2)(x+3)$",
      "$(x+4)(x+1)$",
    ],
    correctIndex: 3,
    points: "1",
    questionType: "single-choice",
    difficulty: "easy",
  },
  {
    questionText:
      "Параболын тэгш хэмийн тэнхлэгийг олоорой. $f(x)=(x-1)^2+3$",
    answers: ["$x=3$", "$x=2$", "$x=-1$", "$x=0$", "$x=1$"],
    correctIndex: 4,
    points: "1",
    questionType: "single-choice",
    difficulty: "easy",
  },
  {
    questionText:
      "Адил хажуут гурвалжны оройн өнцөг $100^\\circ$ бол суурийн өнцгийг олоорой.",
    answers: [
      "$45^\\circ,\\ 35^\\circ$",
      "$30^\\circ,\\ 20^\\circ$",
      "$50^\\circ,\\ 50^\\circ$",
      "$30^\\circ,\\ 50^\\circ$",
      "$40^\\circ,\\ 40^\\circ$",
    ],
    correctIndex: 4,
    points: "1",
    questionType: "single-choice",
    difficulty: "easy",
  },
  {
    questionText:
      "$x=2^3$, $y=5!$ бол $m=8$ ба $n=120$ болох хосыг сонгоно уу.",
    answers: [
      "$m=8,\\ n=120$",
      "$m=4,\\ n=120$",
      "$m=8,\\ n=24$",
      "$m=5,\\ n=120$",
      "$m=1,\\ n=960$",
    ],
    correctIndex: 0,
    points: "2",
    questionType: "single-choice",
    difficulty: "medium",
  },
  {
    questionText: "Тэгшитгэлийг бод. $3x^3-8x^2+14x=0$",
    answers: [
      "$\\{3,-8,14\\}$",
      "$\\{0\\}$",
      "$\\{0,2,4\\}$",
      "$\\{1,2,0\\}$",
      "$\\{1,2,3\\}$",
    ],
    correctIndex: 1,
    points: "1",
    questionType: "single-choice",
    difficulty: "medium",
  },
  {
    questionText:
      "Илэрхийллийн утгыг олоорой.\n$\\sqrt{13\\cdot14\\cdot15\\cdot16+1}=?$",
    answers: [
      "$13\\cdot16+1$",
      "$15\\cdot16$",
      "$15^2+1$",
      "$14\\cdot16$",
      "$14\\cdot16+1$",
    ],
    correctIndex: 1,
    points: "2",
    questionType: "single-choice",
    difficulty: "medium",
  },
  {
    questionText:
      "$45\\%$ нь зэс байх $36$ кг хольц дээр $60\\%$ зэс болгохын тулд хэдэн кг зэс нэмэх хэрэгтэй вэ?",
    answers: ["$12.5$ кг", "$13$ кг", "$13.5$ кг", "$14$ кг", "$10$ кг"],
    correctIndex: 2,
    points: "2",
    questionType: "single-choice",
    difficulty: "medium",
  },
  {
    questionText: "$f(x)=x^2+2$ функцийн буурах завсрыг олоорой.",
    answers: [
      "$(-\\infty;+\\infty)$",
      "$(2;+\\infty)$",
      "$(0;+\\infty)$",
      "$(0;2)$",
      "$(-\\infty;0)$",
    ],
    correctIndex: 4,
    points: "1",
    questionType: "single-choice",
    difficulty: "medium",
  },
  {
    questionText: "Тэгшитгэл бод. $|8x-3|=|9-x|$",
    answers: [
      "$\\left\\{-\\frac{6}{7},\\ \\frac{4}{3}\\right\\}$",
      "$\\{0,\\ \\frac{4}{3}\\}$",
      "$\\{3,4\\}$",
      "$\\{0,7\\}$",
      "$\\{1,25\\}$",
    ],
    correctIndex: 0,
    points: "2",
    questionType: "single-choice",
    difficulty: "hard",
  },
  {
    questionText:
      "Шоог $1$ удаа хаяхад тав гэсэн нүдээрээ тусах магадлалыг ол.",
    answers: [
      "$\\frac{1}{6}$",
      "$\\frac{1}{5}$",
      "$\\frac{1}{4}$",
      "$\\frac{1}{2}$",
      "$\\frac{1}{12}$",
    ],
    correctIndex: 0,
    points: "1",
    questionType: "single-choice",
    difficulty: "easy",
  },
  {
    questionText: "$2x^2+7x-9=0$ тэгшитгэлийн шийдүүдийн нийлбэрийг олоорой.",
    answers: ["$-9$", "$-4.5$", "$-3.5$", "$-7$", "$7$"],
    correctIndex: 2,
    points: "1",
    questionType: "single-choice",
    difficulty: "medium",
  },
  {
    questionText: "$y=x$ шулууны хувьд харилцан тэгш хэмтэй цэгүүдийг сонгоно уу.",
    answers: [
      "$A(-2;6),\\ B(2;-6)$",
      "$C(7;-4),\\ D(-4;7)$",
      "$E(-5;-7),\\ F(5;7)$",
      "$M(3;1),\\ N(-1;-3)$",
      "$L(-8;2),\\ O(8;-2)$",
    ],
    correctIndex: 1,
    points: "1",
    questionType: "single-choice",
    difficulty: "medium",
  },
];
