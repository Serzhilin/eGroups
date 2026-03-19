import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { signToken } from "../utils/jwt";

export class UserService {
    public userRepository = AppDataSource.getRepository(User);

    async findOrCreateByEname(ename: string): Promise<{ user: User; token: string }> {
        const normalized = ename.startsWith("@") ? ename.slice(1) : ename;
        const withAt = `@${normalized}`;

        let user = await this.userRepository
            .createQueryBuilder("user")
            .where("user.ename = :withAt OR user.ename = :withoutAt", {
                withAt,
                withoutAt: normalized,
            })
            .getOne();

        if (!user) {
            user = this.userRepository.create({
                ename: normalized,
                name: normalized,
                isVerified: false,
                isPrivate: false,
                isArchived: false,
            });
            user = await this.userRepository.save(user);
        }

        const token = signToken({ userId: user.id });
        return { user, token };
    }

    async findByEname(ename: string): Promise<User | null> {
        const normalized = ename.startsWith("@") ? ename.slice(1) : ename;
        const withAt = `@${normalized}`;
        return this.userRepository
            .createQueryBuilder("user")
            .where("user.ename = :withAt OR user.ename = :withoutAt", {
                withAt,
                withoutAt: normalized,
            })
            .getOne();
    }

    async getUserById(id: string): Promise<User | null> {
        return this.userRepository.findOneBy({ id });
    }

    async updateUser(id: string, data: Partial<User>): Promise<User | null> {
        await this.userRepository.update(id, data);
        return this.getUserById(id);
    }

    async findByExternalMetaEnvelopeId(externalMetaEnvelopeId: string): Promise<User | null> {
        return this.userRepository.findOneBy({ externalMetaEnvelopeId });
    }

    async createBlankUser(ename: string): Promise<User> {
        const normalized = ename.startsWith("@") ? ename.slice(1) : ename;
        const user = this.userRepository.create({
            ename: normalized,
            name: normalized,
            isVerified: false,
            isPrivate: false,
            isArchived: false,
        });
        return this.userRepository.save(user);
    }
}
