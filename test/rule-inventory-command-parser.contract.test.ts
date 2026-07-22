import { RuleInventoryCommandParser } from "../src/household-supplies/parser/rule-inventory-command-parser.js";
import { inventoryCommandParserContract } from "./inventory-command-parser.contract.test.js";

inventoryCommandParserContract(
  () => new RuleInventoryCommandParser(),
);
