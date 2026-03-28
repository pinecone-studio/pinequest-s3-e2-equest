import { CreateAiExamComponent } from "./_components/CreateAiExamComponent";

export default function AiExamPage() {
  return (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          AI-д суурилсан сорил үүсгэгч
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          Асуултаа бичээд AI-аар шинжлүүлж, шалгалтын загвар үүсгэнэ үү.
        </p>
      </header>

      <CreateAiExamComponent />
    </div>
  );
}
