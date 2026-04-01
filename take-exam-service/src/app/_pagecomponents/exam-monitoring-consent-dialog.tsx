"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type ExamMonitoringConsentDialogProps = {
  isSubmitting?: boolean;
  open: boolean;
  onAccept: () => void;
  onOpenChange: (open: boolean) => void;
  onDecline: () => void;
};

export function ExamMonitoringConsentDialog({
  isSubmitting = false,
  open,
  onAccept,
  onOpenChange,
  onDecline,
}: ExamMonitoringConsentDialogProps) {
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsChecked(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle>Шалгалтын хяналтын зөвшөөрөл</DialogTitle>
          <DialogDescription>
            Энэхүү шалгалтын үеэр академик шударга байдлыг хангахын тулд
            дэлгэцийн хяналт ашиглаж болно. Сэжигтэй үйлдэл илэрвэл screenshot
            авч магадгүй.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Checkbox
            id="exam-monitoring-consent"
            checked={isChecked}
            disabled={isSubmitting}
            onCheckedChange={(checked) => setIsChecked(Boolean(checked))}
          />
          <Label
            htmlFor="exam-monitoring-consent"
            className="cursor-pointer text-sm leading-6 text-slate-700"
          >
            Дэлгэцийн хяналтыг зөвшөөрч байна
          </Label>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          Screen sharing зөвшөөрөх бол browser дээрх <strong>Entire screen</strong>
          буюу <strong>Бүтэн дэлгэц</strong>-ийг сонгоно уу. Өөр сонголт хийсэн
          эсвэл зөвшөөрөл өгөөгүй байсан ч шалгалт эхэлнэ, харин хяналт
          хязгаарлагдмал байж болно.
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={isSubmitting}
            onClick={onDecline}
            type="button"
            variant="outline"
          >
            Зөвшөөрөхгүй, үргэлжлүүлэх
          </Button>
          <Button
            disabled={!isChecked || isSubmitting}
            onClick={onAccept}
            type="button"
          >
            Зөвшөөрөөд үргэлжлүүлэх
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
