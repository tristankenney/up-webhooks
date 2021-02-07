import { SNSHandler } from "aws-lambda";
import { AccountTypeEnum, TransactionResource, UpApi } from "up-bank-api";
import { env, uptime } from "process";

const up = new UpApi(env.UP_TOKEN);

export const handler: SNSHandler = async (event) => {
  const tags = <any>await up.tags.list();
  const since = new Date();
  since.setDate(since.getDate() - 2);
  const recentTransactions = await up.transactions.list({
    filterSince: since.toISOString(),
  });

  const untaggedTransactions = recentTransactions.data.filter(
    (transaction) =>
      !transaction.relationships.tags.data.length &&
      transaction.attributes.amount.valueInBaseUnits < 0 &&
      transaction.relationships.category.data !== null
  );

  event.Records.map((value) => JSON.parse(value.Sns.Message)).map((value) => {
    const transaction = <TransactionResource>value.data;
    const lookup = transaction.attributes.description.replace(/Cover from/, "");
    const tag = tags.data.find((tag) => tag.id.includes(lookup));
    const untaggedTransaction = untaggedTransactions.find(
      (untagged) => total(untagged) + total(transaction) === 0
    );
    if (tag && untaggedTransaction) {
      up.tags.addTagsToTransaction(untaggedTransaction.id, [tag]);
    }
  });
};

const total = (transaction: TransactionResource) => {
  return (
    transaction.attributes.amount.valueInBaseUnits +
    (transaction.attributes.roundUp
      ? transaction.attributes.roundUp.amount.valueInBaseUnits
      : 0)
  );
};
