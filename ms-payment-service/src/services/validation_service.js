const Ajv = require("ajv");
const ajv = new Ajv();

const paymentSchema = {
  type: "object",
  properties: {
    user_id: { type: "string" },
    amount: { type: "number" },
    currency: { type: "string" },
    description: { type: "string" },
  },
  required: ["user_id", "amount", "currency", "description"],
  additionalProperties: false,
};

exports.validateJson = (requestBody) => {
  const valid = ajv.validate(paymentSchema, requestBody);
  if (valid) return true;

  console.log(ajv.errors);
  return false;
};
