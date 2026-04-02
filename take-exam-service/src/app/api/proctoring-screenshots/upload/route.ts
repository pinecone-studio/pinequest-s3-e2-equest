// import { PutObjectCommand } from "@aws-sdk/client-s3";
// import { buildProctoringScreenshotKey } from "@/lib/proctoring-screenshots";
// import {
//   buildProctoringObjectUrl,
//   corsHeaders,
//   createStorageUnavailableResponse,
//   getRequiredEnv,
//   getMissingStorageEnvKeys,
//   getProctoringStorageClient,
// } from "../shared";

// const getFormDataValue = (formData: FormData, key: string) => {
//   const value = formData.get(key);
//   return typeof value === "string" ? value.trim() : "";
// };

// const resolveUploadKey = (formData: FormData) => {
//   const providedKey = getFormDataValue(formData, "key");
//   if (providedKey) {
//     return providedKey;
//   }

//   const attemptId = getFormDataValue(formData, "attemptId");
//   const capturedAt = getFormDataValue(formData, "capturedAt");
//   const eventCode = getFormDataValue(formData, "eventCode");
//   const mode = getFormDataValue(formData, "mode");
//   const studentName = getFormDataValue(formData, "studentName");
//   const userId = getFormDataValue(formData, "userId");

//   if (!attemptId || !capturedAt || !eventCode || !userId) {
//     return null;
//   }

//   return buildProctoringScreenshotKey({
//     attemptId,
//     capturedAt,
//     eventCode,
//     mode,
//     studentName,
//     userId,
//   });
// };

// export function OPTIONS() {
//   return new Response(null, {
//     status: 204,
//     headers: corsHeaders,
//   });
// }

// export async function POST(request: Request) {
//   try {
//     const requestUrl = new URL(request.url);
//     const formData = await request.formData();
//     const key = resolveUploadKey(formData);
//     const file = formData.get("file");

//     if (!key) {
//       return Response.json(
//         {
//           message:
//             "key эсвэл attemptId, capturedAt, eventCode, userId талбарууд заавал байна.",
//         },
//         { status: 400, headers: corsHeaders },
//       );
//     }

//     if (!(file instanceof File)) {
//       return Response.json(
//         { message: "file is required." },
//         { status: 400, headers: corsHeaders },
//       );
//     }

//     const missingEnvKeys = getMissingStorageEnvKeys();
//     if (missingEnvKeys.length > 0) {
//       return createStorageUnavailableResponse(missingEnvKeys);
//     }

//     const client = getProctoringStorageClient();
//     const body = new Uint8Array(await file.arrayBuffer());

//     await client.send(
//       new PutObjectCommand({
//         Bucket: getRequiredEnv("R2_PROCTORING_BUCKET_NAME"),
//         CacheControl: "private, max-age=31536000, immutable",
//         ContentType: file.type || "image/jpeg",
//         Key: key,
//         Body: body,
//       }),
//     );

//     return Response.json(
//       {
//         key,
//         publicUrl: buildProctoringObjectUrl(requestUrl, key),
//       },
//       {
//         status: 200,
//         headers: corsHeaders,
//       },
//     );
//   } catch (error) {
//     return Response.json(
//       {
//         message:
//           error instanceof Error
//             ? error.message
//             : "Screenshot upload fallback амжилтгүй боллоо.",
//       },
//       {
//         status: 500,
//         headers: corsHeaders,
//       },
//     );
//   }
// }
