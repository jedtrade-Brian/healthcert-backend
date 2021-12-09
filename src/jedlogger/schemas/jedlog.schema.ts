// import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// import { Document } from 'mongoose';

// @Schema()
// export class Log extends Document {
//   @Prop()
//   time: string;
//   required: true;

//   @Prop()
//   type: string;

//   @Prop()
//   category: string;

//   @Prop()
//   description: string;
// }

// export const JedLogSchema = SchemaFactory.createForClass(Log);
import * as mongoose from 'mongoose';

export const JedLogSchema = new mongoose.Schema({
  time: {
    type: String,
  },
  type: { type: String },
  category: { type: String },
  description: { type: String },
});
