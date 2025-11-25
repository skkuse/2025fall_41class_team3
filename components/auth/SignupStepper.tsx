interface Step {
  id: number;
  label: string;
}

interface SignupStepperProps {
  steps: Step[];
  currentStep: number;
}

export default function SignupStepper({ steps, currentStep }: SignupStepperProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = step.id < currentStep;
        const circleColor = isActive ? "bg-[#2f6bff] text-white" : "bg-white text-[#6a7281]";
        const circleBorder = isActive || isCompleted ? "border-[#2f6bff]" : "border-[#d4d8df]";
        const lineColor = isCompleted ? "bg-[#2f6bff]" : "bg-[#d8dbe1]";

        return (
          <div key={step.id} className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${circleColor} ${circleBorder} text-xl font-bold`}
              >
                {step.id}
              </div>
              <span className="text-xs font-semibold text-[#4a5260]">{step.label}</span>
            </div>
            {index < steps.length - 1 ? (
              <div className={`h-[2px] w-16 ${lineColor}`} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
