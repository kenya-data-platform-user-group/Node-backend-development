export interface Post {
  title: string;
  content: string;
  author: string;
  tags: string[];
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}
