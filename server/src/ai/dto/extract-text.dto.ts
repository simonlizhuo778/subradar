import { IsString, Length } from 'class-validator';

export class ExtractTextDto {
  @IsString()
  @Length(1, 4000)
  text!: string;
}
