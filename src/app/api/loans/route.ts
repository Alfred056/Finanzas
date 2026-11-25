import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateLoanAmortization } from "@/services/financeEngine";
import { dec, HttpError, int, readBody, respond, str } from "@/lib/http";

export const GET = () =>
  respond(async () => {
    const loans = await prisma.loan.findMany({ where: { userId: await requireUserId() } });
    return loans.map((l) => ({
      ...l,
      amortization: calculateLoanAmortization(
        l.principalAmount, l.annualInterestRate, l.totalInstallments, l.paidInstallments, l.monthlyPayment,
      ),
    }));
  });

export const POST = (req: Request) =>
  respond(async () => {
    const userId = await requireUserId();
    const b = await readBody(req);
    const totalInstallments = int(b, "totalInstallments", 1, 1200);
    const paidInstallments = int(b, "paidInstallments", 0, 1200, 0);
    if (paidInstallments > totalInstallments) throw new HttpError(400, "paidInstallments no puede exceder totalInstallments");
    return prisma.loan.create({
      data: {
        userId,
        lenderName: str(b, "lenderName"),
        principalAmount: dec(b, "principalAmount", { positive: true }),
        annualInterestRate: dec(b, "annualInterestRate"),
        totalInstallments,
        paidInstallments,
        monthlyPayment: dec(b, "monthlyPayment", { positive: true }),
        paymentDay: int(b, "paymentDay", 1, 31),
      },
    });
  }, 201);
