import { APIGatewayProxyHandlerV2, Handler } from "aws-lambda";
import { SNS } from "aws-sdk";
import { env } from "process";
import { TransactionResource, UpApi } from "up-bank-api";

export const handler: APIGatewayProxyHandlerV2 = async (event: any) => {
  const body = JSON.parse(event.body || "null");

  if (body) {
    const up = new UpApi(env.UP_TOKEN);
    const TopicArn = env.TOPIC_ARN;
    const transaction = await up.transactions.retrieve(
      body.data.relationships.transaction.links.related
    );

    const Message = JSON.stringify({
      webhook: body.data,
      ...transaction,
    });

    const sns = new SNS();
    console.log(Message);
    sns.publish(
      {
        Message,
        TopicArn,
        MessageAttributes: getMessageAttributes(transaction.data),
      },
      (err, data) => {
        if (err) console.log(err, err.stack);
        // an error occurred
        else console.log(data); // successful response
      }
    );
  }

  return { statusCode: 200 };
};

const getMessageAttributes = (
  transaction: TransactionResource
): SNS.MessageAttributeMap => {
  return {
    transactionType: {
      DataType: "string",
      StringValue: getTransactionType(transaction),
    },
  };
};

const getTransactionType = (transaction: TransactionResource): string => {
  const description = transaction.attributes.description;
  const rawText = transaction.attributes.rawText;
  const amount = transaction.attributes.amount;
  const relationships = transaction.relationships;
  const types = {
    Cover: () => description.startsWith("Cover from"),
    Transfer: () =>
      description.startsWith("Transfer from") ||
      description.startsWith("Transfer to"),
    Forward: () => description.startsWith("Forward to"),
    "Quick save": () => description.startsWith("Quick save"),
    Funding: () =>
      amount.valueInBaseUnits > 0 &&
      relationships.category.data === null &&
      description != rawText,
    Transaction: () => true,
  };
  return Object.entries(types)
    .find(([type, test]) => test())
    .shift();
};
