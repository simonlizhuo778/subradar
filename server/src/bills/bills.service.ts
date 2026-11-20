import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decodeCsvText } from '../common/utils/csv';
import { detectRecurring } from '../common/utils/recurring-detect';
import { parseBillCsv } from './parse-bill';
import { BillFormatError } from './parse-bill';

const MAX_CSV_SIZE = 10 * 1024 * 1024;

interface UploadFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 上传账单 → 解析 → 流水入库 → 周期识别 → 生成待确认候选。
   * 候选走既有的待确认队列,复用整套确认/入库/回填流程。
   */
  async importCsv(userId: number, source: string, file: UploadFile) {
    if (!file || file.size === 0) {
      throw new BadRequestException('请上传账单 CSV 文件');
    }
    if (file.size > MAX_CSV_SIZE) {
      throw new BadRequestException('文件过大(上限 10MB)');
    }
    if (!['alipay', 'wechat', 'other'].includes(source)) {
      throw new BadRequestException('source 应为 alipay / wechat / other');
    }

    let parsed;
    try {
      parsed = parseBillCsv(decodeCsvText(file.buffer));
    } catch (e) {
      if (e instanceof BillFormatError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    if (parsed.rows.length === 0) {
      throw new BadRequestException(
        parsed.failedRows.length > 0
          ? `没有解析出有效的支出流水(解析失败 ${parsed.failedRows.length} 行),请确认文件格式`
          : '没有解析出支出流水:文件里可能全是收入或不计收支交易',
      );
    }

    const importRecord = await this.prisma.billImport.create({
      data: {
        userId,
        source,
        filename: file.originalname || 'bill.csv',
        totalRows: parsed.totalRows,
        validRows: parsed.rows.length,
        status: 'parsed',
      },
    });

    // 流水入库(逐条创建,量级可控;raw 存原始摘要便于排查)
    for (const row of parsed.rows) {
      await this.prisma.billTransaction.create({
        data: {
          importId: importRecord.id,
          userId,
          occurredAt: row.occurredAt,
          merchant: row.merchant,
          amount: row.amount,
          direction: row.direction,
          memo: row.memo,
          raw: JSON.stringify({ memo: row.memo }),
        },
      });
    }

    // 周期识别 → 候选(source=bill,通过 rawRef=bill:{importId} 关联回本次导入)
    const detected = detectRecurring(
      parsed.rows.map((row) => ({
        occurredAt: row.occurredAt,
        merchant: row.merchant,
        amount: row.amount,
      })),
    );

    const paymentMethod =
      source === 'alipay' ? 'alipay' : source === 'wechat' ? 'wechat' : null;

    const candidates = [];
    for (const series of detected) {
      const row = await this.prisma.subscriptionCandidate.create({
        data: {
          userId,
          source: 'bill',
          rawRef: `bill:${importRecord.id}`,
          extracted: JSON.stringify({
            is_subscription: true,
            name: series.displayName,
            merchant: series.merchant,
            amount: series.amount,
            currency: 'CNY',
            cycle: series.cycle,
            cycle_days: series.cycleDays,
            first_payment_date: series.firstPaymentDate,
            next_payment_date: null,
            payment_method: paymentMethod,
            auto_renew: null,
            confidence: series.confidence,
            evidence: series.evidence,
          }),
          confidence: series.confidence,
          status: 'pending',
        },
      });
      candidates.push({ ...row, extracted: JSON.parse(row.extracted) });
    }

    await this.prisma.billImport.update({
      where: { id: importRecord.id },
      data: { status: 'detected' },
    });

    return {
      import: {
        id: importRecord.id,
        source,
        filename: importRecord.filename,
        totalRows: parsed.totalRows,
        validRows: parsed.rows.length,
        status: 'detected',
      },
      failed: {
        count: parsed.failedRows.length,
        samples: parsed.failedRows.slice(0, 5),
      },
      candidates,
      message: `解析 ${parsed.rows.length} 条支出流水,识别出 ${candidates.length} 个疑似订阅,已加入待确认队列`,
    };
  }

  async history(userId: number) {
    return this.prisma.billImport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async detail(userId: number, id: number) {
    const record = await this.prisma.billImport.findFirst({ where: { id, userId } });
    if (!record) {
      throw new NotFoundException('导入记录不存在');
    }
    const [transactions, candidates] = await Promise.all([
      this.prisma.billTransaction.findMany({
        where: { importId: id },
        orderBy: { occurredAt: 'desc' },
        take: 200,
      }),
      this.prisma.subscriptionCandidate.findMany({
        where: { userId, rawRef: `bill:${id}` },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      import: record,
      transactions,
      candidates: candidates.map((c) => ({ ...c, extracted: JSON.parse(c.extracted) })),
    };
  }
}
